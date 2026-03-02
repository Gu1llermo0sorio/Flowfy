import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Configured Axios instance for Flowfy API.
 * Automatically attaches Bearer token and handles 401 refresh flow.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true, // send httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ───────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ─────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue request until refresh is done
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Send stored refresh token in body as fallback for Safari ITP
        // (Safari blocks cross-origin httpOnly cookies)
        const storedRT = localStorage.getItem('refreshToken');
        const { data } = await apiClient.post<{ accessToken: string; refreshToken?: string }>(
          '/auth/refresh',
          storedRT ? { refreshToken: storedRT } : {}
        );
        const newToken = data.accessToken;
        localStorage.setItem('accessToken', newToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);

        // Replay queued requests
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — clear auth state
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        refreshQueue = [];
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

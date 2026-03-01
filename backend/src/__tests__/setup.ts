// Global test setup
import { vi } from 'vitest';

// Ensure environment variables exist for tests
process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-ok';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock bcryptjs to speed up tests (no need to actually hash)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pwd: string) => `hashed_${pwd}`),
    compare: vi.fn(async (pwd: string, hash: string) => hash === `hashed_${pwd}`),
  },
  hash: vi.fn(async (pwd: string) => `hashed_${pwd}`),
  compare: vi.fn(async (pwd: string, hash: string) => hash === `hashed_${pwd}`),
}));

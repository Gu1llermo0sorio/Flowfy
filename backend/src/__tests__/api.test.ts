import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mock Prisma before importing app ──────────────────────────────────────────
vi.mock('../lib/prisma', () => ({
  prisma: {
    family: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    subcategory: {
      create: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    badge: {
      findMany: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
    },
    challenge: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      family: { create: vi.fn() },
      user: { create: vi.fn() },
      category: { createMany: vi.fn() },
      subcategory: { createMany: vi.fn() },
    })),
  },
}));

// ── Mock cron jobs (no DB calls on import) ────────────────────────────────────
vi.mock('../jobs', () => ({ startCronJobs: vi.fn() }));

// ── Mock categories service ────────────────────────────────────────────────────
vi.mock('../services/categories.service', () => ({
  seedDefaultCategories: vi.fn(async () => {}),
  getCategoriesForFamily: vi.fn(async () => []),
}));

// ── Mock xp service ────────────────────────────────────────────────────────────
vi.mock('../services/xp.service', () => ({
  awardXP: vi.fn(async () => ({ xp: 10, level: 1, leveledUp: false })),
  checkBadges: vi.fn(async () => []),
}));

// ── Import app AFTER mocks ────────────────────────────────────────────────────
import { app } from '../app';
import { prisma } from '../lib/prisma';

const db = prisma as ReturnType<typeof vi.mocked<typeof prisma>>;

// ── Helpers ────────────────────────────────────────────────────────────────────
const validRegisterPayload = {
  name: 'Juan García',
  email: 'juan@test.com',
  password: 'Password123',
  familyName: 'Familia García',
};

const mockUser = {
  id: 'user-id-1',
  email: 'juan@test.com',
  name: 'Juan García',
  passwordHash: 'hashed_Password123',
  role: 'owner',
  familyId: 'family-id-1',
  xp: 0,
  level: 1,
  streakDays: 0,
  lastActive: new Date(),
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  family: { id: 'family-id-1', name: 'Familia García', currency: 'UYU' },
};

const mockFamily = {
  id: 'family-id-1',
  name: 'Familia García',
  currency: 'UYU',
  ownerEmail: 'juan@test.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.app).toBe('Flowfy API');
  });
});

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 when body is empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
  });

  it('returns 422 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterPayload, email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterPayload, password: 'abc' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when email already exists', async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('existe');
  });

  it('creates user and returns token on success', async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null); // email check returns null
    const txFamily = { ...mockFamily };
    const txUser = { ...mockUser };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          family: { create: vi.fn(async () => txFamily) },
          user: { create: vi.fn(async () => txUser) },
        })
    );
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'refresh-token',
      userId: 'user-id-1',
      expiresAt: new Date(),
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('juan@test.com');
    expect(res.body.user.passwordHash).toBeUndefined(); // never expose hash
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(422);
  });

  it('returns 401 when user not found', async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is wrong', async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      passwordHash: 'hashed_CorrectPassword',
      family: { id: 'f1', name: 'Test', currency: 'UYU' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'juan@test.com', password: 'WrongPassword' });
    expect(res.status).toBe(401);
  });

  it('returns token on successful login', async () => {
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      passwordHash: 'hashed_Password123',
      family: { id: 'f1', name: 'Familia García', currency: 'UYU' },
    });
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'refresh-token',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'juan@test.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('juan@test.com');
  });
});

describe('Protected routes (no auth)', () => {
  it('GET /api/transactions returns 401 without token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET /api/categories returns 401 without token', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  it('GET /api/family returns 401 without token', async () => {
    const res = await request(app).get('/api/family');
    expect(res.status).toBe(401);
  });

  it('GET /api/gamification/my-stats returns 401 without token', async () => {
    const res = await request(app).get('/api/gamification/my-stats');
    expect(res.status).toBe(401);
  });
});

describe('Token authentication flow', () => {
  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user with valid token', async () => {
    // findUnique called 3 times: login route, auth middleware (token verify), /me handler
    (db.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ // 1. login email lookup
        ...mockUser,
        passwordHash: 'hashed_Password123',
        family: { id: 'f1', name: 'Familia García', currency: 'UYU' },
      })
      .mockResolvedValueOnce({ // 2. auth middleware existence check
        id: mockUser.id, familyId: mockUser.familyId, role: mockUser.role,
      })
      .mockResolvedValueOnce({ // 3. /me handler - full user with relations
        ...mockUser,
        family: { id: 'f1', name: 'Familia García', currency: 'UYU' },
        userBadges: [],
      });
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'rt' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'juan@test.com', password: 'Password123' });

    const { accessToken } = loginRes.body;
    expect(accessToken).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('juan@test.com');
  });
});

describe('Exchange rate endpoint', () => {
  it('GET /api/exchange-rates/latest returns fallback when no rate in DB', async () => {
    // findUnique: 1. login, 2. auth middleware for /exchange-rates/latest
    (db.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ...mockUser,
        passwordHash: 'hashed_Password123',
        family: { id: 'f1', name: 'Familia García', currency: 'UYU' },
      })
      .mockResolvedValueOnce({
        id: mockUser.id, familyId: mockUser.familyId, role: mockUser.role,
      });
    (db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (db.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'rt' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'juan@test.com', password: 'Password123' });

    const { accessToken } = loginRes.body;
    expect(accessToken).toBeDefined();

    (db.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/exchange-rates/latest')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBe(39);
    expect(res.body.data.source).toBe('fallback');
  });
});

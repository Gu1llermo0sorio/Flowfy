// ── User & Auth ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
  avatarColor?: string;
  role: 'owner' | 'partner' | 'ADMIN';
  familyId: string;
  familyName?: string;
  familyCurrency?: string;
  xp: number;
  level: number;
  /** Computed title for the current level, e.g. "Ahorrador Novato" */
  levelTitle?: string;
  /** XP needed to reach the next level */
  nextLevelXp?: number;
  streakDays: number;
  lastActive?: string;
  badges?: BadgeWithDate[];
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

// ── Family ────────────────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'partner';
  xp: number;
  level: number;
  streakDays: number;
  lastActive?: string;
}

export interface Family {
  id: string;
  name: string;
  currency: string;
  users: FamilyMember[];
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface Subcategory {
  id: string;
  name: string;
  nameEs: string;
  icon?: string;
  categoryId: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  nameEs: string;
  icon: string;
  color: string;
  isCustom: boolean;
  familyId?: string;
  sortOrder: number;
  subcategories: Subcategory[];
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense';
export type Currency = 'UYU' | 'USD';
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer' | 'other';
export type ImportSource = 'manual' | 'pdf' | 'ocr' | 'email';

export interface Transaction {
  id: string;
  amount: number;         // in centavos
  currency: Currency;
  amountUYU: number;      // in centavos UYU
  exchangeRateUsed?: number;
  description: string;
  date: string;           // ISO string
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  userId: string;
  familyId: string;
  paymentMethod?: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  tags: string[];
  isRecurring: boolean;
  recurringId?: string;
  importSource?: ImportSource;
  institutionId?: string;
  isOcaInstallment: boolean;
  ocaTotalAmount?: number;
  ocaTotalInstallments?: number;
  ocaCurrentInstallment?: number;
  linkedTransactionId?: string;
  aiCategoryConfidence?: number;
  needsReview: boolean;
  createdAt: string;
  // Included relations
  category?: {
    id: string;
    nameEs: string;
    icon: string;
    color: string;
  };
  subcategory?: {
    id: string;
    nameEs: string;
    icon?: string;
  };
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: TransactionType;
  categoryId?: string;
  userId?: string;
  currency?: Currency;
  from?: string;
  to?: string;
  search?: string;
  tags?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'date' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  byCategory: Array<{
    categoryId: string;
    amount: number;
    name: string;
    icon: string;
    color: string;
  }>;
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  familyId: string;
  categoryId: string;
  userId?: string;
  amount: number;
  currency: Currency;
  month: number;
  year: number;
  rollover: boolean;
  rolloverAmount: number;
  // Enriched
  spent?: number;
  percentage?: number;
  category?: Pick<Category, 'id' | 'nameEs' | 'icon' | 'color'>;
  user?: Pick<FamilyMember, 'id' | 'name' | 'avatar'>;
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export type GoalType = 'savings' | 'debt' | 'spending_reduction' | 'income';

export interface Goal {
  id: string;
  familyId: string;
  userId?: string;
  name: string;
  description?: string;
  type: GoalType;
  targetAmount: number;
  currency: Currency;
  targetDate?: string;
  currentAmount: number;
  isCompleted: boolean;
  completedAt?: string;
  emoji?: string;
  milestones: number[];
  createdAt: string;
  user?: Pick<FamilyMember, 'id' | 'name' | 'avatar'>;
}

// ── Gamification ──────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  code: string;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string;
  xpReward: number;
  sortOrder: number;
}

export interface BadgeWithDate extends Badge {
  unlockedAt: string;
}

export interface LevelInfo {
  level: number;
  title: string;
  nextLevelXP: number | null;
  progress: number;
}

export interface GamificationStats {
  xp: number;
  level: number;
  streakDays: number;
  levelInfo: LevelInfo;
  badges: BadgeWithDate[];
}

export interface Challenge {
  id: string;
  familyId: string;
  userId?: string;
  name: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
  xpReward: number;
  progress: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'budget_warning'
  | 'bill_due'
  | 'goal_milestone'
  | 'streak'
  | 'recommendation'
  | 'salary'
  | 'oca_due'
  | 'level_up'
  | 'badge';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── Exchange Rate ─────────────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  source: string;
}

// ── Recommendation ────────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  familyId: string;
  content: string;
  type: 'spending' | 'savings' | 'goal' | 'alert' | 'celebration';
  ctaAction?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

// ── API Response ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

# Flowfy 💰

> Finanzas familiares gamificadas con IA — Uruguay

## Stack

| Capa      | Tecnología |
|-----------|-----------|
| Backend   | Node.js + Express + TypeScript, Prisma ORM |
| Base de datos | PostgreSQL (Railway) |
| Frontend  | React 18 + Vite 5 + TypeScript |
| UI        | Tailwind CSS v3 + Framer Motion |
| Estado    | Zustand + TanStack Query v5 |
| Auth      | JWT (access 15min) + httpOnly refresh token (7d) |

---

## Setup rápido

### 1. Prerrequisitos

- Node.js ≥ 18
- PostgreSQL local **o** cuenta en [Railway](https://railway.app)

### 2. Backend

```bash
cd backend
# Copia y editá las variables
cp .env.example .env
# Editá DATABASE_URL con tu cadena de conexión PostgreSQL

npm install
npm run db:generate    # genera el cliente Prisma
npm run db:migrate     # aplica las migraciones (requiere DATABASE_URL)
npm run db:seed        # seedea las 12 badges
npm run dev            # servidor en http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
# .env ya está creado con VITE_API_URL=http://localhost:3001
npm install
npm run dev            # app en http://localhost:5173
```

---

## Variables de entorno imprescindibles

### Backend (`backend/.env`)

| Variable | Descripción |
|----------|-----------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL (Railway o local) |
| `JWT_SECRET` | Clave secreta JWT (mín. 32 chars) |
| `JWT_REFRESH_SECRET` | Clave secreta refresh token |

Las demás variables (Anthropic, Cloudinary, SendGrid, ExchangeRate) son opcionales para la Fase 1.

### Frontend (`frontend/.env`)

| Variable | Descripción |
|----------|-----------|
| `VITE_API_URL` | URL del backend (default: `http://localhost:3001`) |

---

## Scripts útiles

```bash
# Backend
npm run dev          # tsx watch
npm run build        # tsc --outDir dist
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:seed      # npx tsx prisma/seed.ts

# Frontend  
npm run dev          # vite dev
npm run build        # vite build
npm run preview      # vite preview
```

---

## Estructura de carpetas

```
Flowfy/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       ← 18 modelos
│   │   └── seed.ts             ← 12 badges
│   └── src/
│       ├── index.ts            ← Express entry
│       ├── lib/                ← prisma, tokens
│       ├── middleware/         ← auth, validate, upload...
│       ├── routes/             ← auth, transactions, budgets...
│       ├── services/           ← categories, xp, fx
│       └── jobs/               ← cron jobs
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/         ← AppLayout, Navbar, Sidebar, BottomNav
        │   └── ui/             ← ToastContainer, XPToastContainer
        ├── lib/                ← apiClient, formatters
        ├── pages/
        │   ├── auth/           ← LoginPage, RegisterPage
        │   ├── Dashboard.tsx
        │   └── ...stubs        ← Transactions, Budgets, Goals...
        ├── stores/             ← authStore, uiStore
        └── types/              ← index.ts (todas las interfaces)
```

---

## Fases de desarrollo

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Auth, CRUD, categorías, schema | ✅ Completo |
| 2 | UI enriquecida, transacciones avanzadas | 🔜 Siguiente |
| 3 | OCR/PDF, importación de extractos | Pendiente |
| 4 | Asistente IA (Claude) | Pendiente |
| 5 | Analytics y gráficos | Pendiente |
| 6 | OCA cuotas | Pendiente |
| 7 | Metas avanzadas | Pendiente |
| 8 | Sincronización email | Pendiente |
| 9 | PWA + producción | Pendiente |

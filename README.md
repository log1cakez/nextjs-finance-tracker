# MIDAS Finance Tracker

Personal finance web app: accounts, transactions, recurring templates, transfers, lending (receivables / payables with installment payments), category-based income and expenses, and a dashboard with cashflow trends and projections. Built with [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/) 19, [TypeScript](https://www.typescriptlang.org/), and [Tailwind CSS](https://tailwindcss.com/).

## Features

- **Dashboard**
  - **This month** — Income, expenses, and net for the current calendar month (navbar currency).
  - **Cash flow trend** — Chart of income vs expenses over recent months.
  - **Position & projections** — Assets and liabilities from recorded activity, **starting balances** you set when adding cash-like accounts, **credit card balances owed** (for cards with a limit configured; matches utilization on Accounts), and outstanding **lending** (receivables in assets, payables in liabilities). Projected monthly/yearly figures use **fixed-amount** recurring templates only (variable-amount templates are excluded).
  - **Incoming & upcoming due dates** — Next due date for each recurring template (income and expense) and next **credit card payment due** (when set on the account). Dates use a simple UTC calendar; align logging with your bank if needed.
  - **Recent activity** — Latest transactions.

- **Transactions** — Encrypted descriptions and amounts at rest (when `TRANSACTIONS_ENCRYPTION_KEY` is set); categories and financial accounts; USD / PHP.

- **Accounts** — Types include **bank** (debit or credit card), **e-wallet**, crypto, forex, business, **cash**, and other. Optional **starting balance** and currency when adding non–credit-card accounts. Credit cards support limit, statement/payment days, and starting balance owed. Per-account recent transaction log.

- **Transfers** — Between your own accounts (not counted as income/expense).

- **Recurring** — Income and expense templates on a schedule; optional **variable amount** (e.g. credit card) with amount entered when logging; optional **credit paydown** expenses on credit cards.

- **Lending** — **Receivables** (others owe you) and **payables** (you owe others); lump-sum or installment-style tracking with payment history.

- **Categories** — Income and expense categories, with shared definitions and optional name suggestions when creating categories.

- **Auth** — Email/password (credentials) and optional Google OAuth; password reset via email OTP (SMTP or Resend).

- **Excel export** — Signed-in users can download a multi-sheet workbook (dashboard-style calculations, activity by account, cashflow trend, and raw data). Filename pattern: `MIDAS_FinanceTracker_<name>_<date>.xlsx`. Available from the dashboard, transactions page, and account menu.

## Tech stack

- [Next.js](https://nextjs.org/) 16, [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack) for dev
- [Auth.js](https://authjs.dev/) (NextAuth v5) with [Drizzle adapter](https://authjs.dev/getting-started/adapters/drizzle)
- [Drizzle ORM](https://orm.drizzle.team/) + [Neon](https://neon.tech/) (PostgreSQL)
- [Recharts](https://recharts.org/) for charts
- [SheetJS (`xlsx`)](https://sheetjs.com/) for spreadsheet export
- [patch-package](https://github.com/ds300/patch-package) — applies a small patch to `next-themes` for React 19 / Next 16 (avoids a client `<script>` warning). Runs on `npm install` via the `postinstall` script.

## Prerequisites

- Node.js 20+ (recommended)
- A [Neon](https://neon.tech/) (or compatible) PostgreSQL database
- For production-like behavior locally: `AUTH_SECRET`, `DATABASE_URL`, and `TRANSACTIONS_ENCRYPTION_KEY` (see [Environment](#environment))

## Quick start

```bash
git clone <your-repo-url>
cd nextjs-finance-tracker
npm install
```

Copy environment template and fill in values:

```bash
cp .env.example .env.local
```

Apply the database schema. For a **new** database, prefer migrations so enum and column history stay in sync:

```bash
npm run db:migrate
```

For quick local iteration you can instead use:

```bash
npm run db:push
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a user, then use the app.

## Environment

Copy [.env.example](.env.example) to `.env.local`. Important variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooled URL on serverless) |
| `AUTH_SECRET` | Session signing; generate e.g. `openssl rand -base64 32` |
| `AUTH_URL` | App origin (e.g. `http://localhost:3000`); Vercel often sets this automatically |
| `TRANSACTIONS_ENCRYPTION_KEY` | 64-char hex (or supported formats) for AES-GCM on transaction payloads; **use the same key on every deploy** |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Optional Google sign-in |
| SMTP or `RESEND_API_KEY` | Optional password-reset and transactional email |

Comments in `.env.example` describe Gmail SMTP, Resend, and optional overrides.

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply SQL migrations (recommended for shared/staging/prod DBs) |
| `npm run db:push` | Push schema to DB (handy for local dev) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:encrypt-transactions` | One-time backfill: encrypt legacy plaintext transaction rows |
| `npm run db:seed` | Seed demo data for an existing user (`SEED_USER_EMAIL` in env; optional `SEED_FORCE=1`) |

## Database

- Schema lives in [src/db/schema.ts](src/db/schema.ts).
- SQL migrations are under [drizzle/](drizzle/).
- **New environments:** run `npm run db:migrate` after setting `DATABASE_URL`. If a feature errors at runtime (e.g. new account type enum value), ensure the latest migrations have been applied on that database.

## Excel export

- **Route:** `GET /api/export/excel` (requires an authenticated session; returns `401` JSON if not signed in).
- The workbook includes dashboard-aligned summaries plus detail sheets (transactions, categories, accounts, transfers, recurring, lending). Amounts are numeric for spreadsheet use.

## Security notes

- Transaction **payloads** are encrypted per-user when `TRANSACTIONS_ENCRYPTION_KEY` is configured; losing the key makes existing ciphertext unreadable.
- Export includes decrypted transaction content for the signed-in user only; treat downloaded files like sensitive data.

## Deploying

- Set the same environment variables on your host (e.g. [Vercel](https://vercel.com/)) as in production `.env`.
- Use a **pooled** Neon connection string for serverless.
- Run **`npm run db:migrate`** against the production database when you deploy schema changes.
- Ensure `postinstall` runs so `patch-package` applies [patches/next-themes+0.4.6.patch](patches/next-themes+0.4.6.patch).

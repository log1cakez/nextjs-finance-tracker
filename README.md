# MIDAS Finance Tracker

Personal finance web app: accounts, transactions, recurring templates, transfers, lending (receivables / payables with installment payments), category-based income and expenses, and a dashboard with cashflow trends and projections. Built with [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/) 19, [TypeScript](https://www.typescriptlang.org/), and [Tailwind CSS](https://tailwindcss.com/).

## Features

- **Dashboard** — Month-to-date income, expenses, and net; chart of recent months; position from transaction activity (assets vs liabilities by account); projected monthly/yearly income and expenses from fixed-amount recurring templates (variable-amount items are excluded from projections).
- **Transactions** — Encrypted descriptions and amounts at rest (when `TRANSACTIONS_ENCRYPTION_KEY` is set); categories and financial accounts; USD / PHP.
- **Accounts** — Banks, crypto, cash, and other account types.
- **Transfers** — Between your own accounts (not counted as income/expense).
- **Recurring** — Income and expense templates; optional **variable amount** (e.g. credit card) with amount entered when logging.
- **Lending** — **Receivables** (others owe you) and **payables** (you owe others); lump-sum or installment-style tracking with payment history.
- **Categories** — Income and expense categories.
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

Apply the database schema to your database (typical for local dev):

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
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema to DB (handy for local dev) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:encrypt-transactions` | One-time backfill: encrypt legacy plaintext transaction rows |
| `npm run db:seed` | Seed demo data for an existing user (`SEED_USER_EMAIL` in env; optional `SEED_FORCE=1`) |

## Database

- Schema lives in [src/db/schema.ts](src/db/schema.ts).
- SQL migrations are under [drizzle/](drizzle/).
- New environments: run `npm run db:migrate` or `npm run db:push` after setting `DATABASE_URL`.

## Excel export

- **Route:** `GET /api/export/excel` (requires an authenticated session; returns `401` JSON if not signed in).
- The workbook includes dashboard-aligned summaries plus detail sheets (transactions, categories, accounts, transfers, recurring, lending). Amounts are numeric for spreadsheet use.

## Security notes

- Transaction **payloads** are encrypted per-user when `TRANSACTIONS_ENCRYPTION_KEY` is configured; losing the key makes existing ciphertext unreadable.
- Export includes decrypted transaction content for the signed-in user only; treat downloaded files like sensitive data.

## Deploying

- Set the same environment variables on your host (e.g. [Vercel](https://vercel.com/)) as in production `.env`.
- Use a **pooled** Neon connection string for serverless.
- Ensure `postinstall` runs so `patch-package` applies [patches/next-themes+0.4.6.patch](patches/next-themes+0.4.6.patch).

## License

Private project unless you add a license file.

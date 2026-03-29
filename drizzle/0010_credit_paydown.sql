ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reduces_credit_balance" boolean DEFAULT false NOT NULL;
ALTER TABLE "recurring_expenses" ADD COLUMN IF NOT EXISTS "credit_paydown" boolean DEFAULT false NOT NULL;

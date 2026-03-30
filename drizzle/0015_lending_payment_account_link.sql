ALTER TABLE "lending_payments" ADD COLUMN IF NOT EXISTS "financial_account_id" uuid;--> statement-breakpoint
ALTER TABLE "lending_payments"
  ADD CONSTRAINT IF NOT EXISTS "lending_payments_financial_account_id_financial_accounts_id_fk"
  FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE set null ON UPDATE no action;


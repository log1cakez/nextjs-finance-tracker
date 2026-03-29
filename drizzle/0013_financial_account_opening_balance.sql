ALTER TABLE "financial_accounts" ADD COLUMN "opening_balance_cents" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "opening_balance_currency" "transaction_currency";

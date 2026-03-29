CREATE TYPE "public"."bank_account_kind" AS ENUM('debit', 'credit');--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "bank_kind" "public"."bank_account_kind";--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_limit_cents" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_limit_currency" "transaction_currency";--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_opening_balance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "financial_accounts" SET "bank_kind" = 'debit' WHERE "type" = 'bank' AND "bank_kind" IS NULL;

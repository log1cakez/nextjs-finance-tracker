CREATE TYPE "public"."bank_account_kind" AS ENUM('debit', 'credit');--> statement-breakpoint
ALTER TYPE "public"."financial_account_type" ADD VALUE 'ewallet' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "app_fx_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"usd_to_php_rate_ppm" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eod_notes_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_transfers" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lending_payments" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lendings" ALTER COLUMN "counterparty_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lendings" ALTER COLUMN "principal_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "definition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "bank_kind" "bank_account_kind";--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "finance_payload" text;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_limit_cents" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_limit_currency" "transaction_currency";--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_opening_balance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_statement_day_of_month" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "credit_payment_due_day_of_month" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "opening_balance_cents" integer;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "opening_balance_currency" "transaction_currency";--> statement-breakpoint
ALTER TABLE "lending_payments" ADD COLUMN "financial_account_id" uuid;--> statement-breakpoint
ALTER TABLE "lending_payments" ADD COLUMN "finance_payload" text;--> statement-breakpoint
ALTER TABLE "lendings" ADD COLUMN "finance_payload" text;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD COLUMN "amount_payload" text;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD COLUMN "credit_paydown" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reduces_credit_balance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "calendar_feed_token_hash" text;--> statement-breakpoint
ALTER TABLE "eod_notes_page" ADD CONSTRAINT "eod_notes_page_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_definitions_name_key_kind" ON "category_definitions" USING btree ("name_key","kind");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_definition_id_category_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."category_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_payments" ADD CONSTRAINT "lending_payments_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_definition_idx" ON "categories" USING btree ("user_id","definition_id");
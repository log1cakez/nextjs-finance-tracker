CREATE TYPE "public"."transaction_currency" AS ENUM('USD', 'PHP');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "currency" "transaction_currency" DEFAULT 'USD' NOT NULL;
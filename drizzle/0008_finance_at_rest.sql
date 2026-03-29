ALTER TABLE "lendings" ADD COLUMN "finance_payload" text;--> statement-breakpoint
ALTER TABLE "lendings" ALTER COLUMN "counterparty_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lendings" ALTER COLUMN "principal_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lendings" ALTER COLUMN "notes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lending_payments" ADD COLUMN "finance_payload" text;--> statement-breakpoint
ALTER TABLE "lending_payments" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lending_payments" ALTER COLUMN "note" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account_transfers" ALTER COLUMN "amount_cents" DROP NOT NULL;

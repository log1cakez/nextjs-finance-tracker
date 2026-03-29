ALTER TABLE "recurring_expenses" ADD COLUMN "amount_variable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ALTER COLUMN "amount_cents" DROP NOT NULL;

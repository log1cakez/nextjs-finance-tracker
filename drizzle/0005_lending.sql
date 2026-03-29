CREATE TYPE "public"."lending_kind" AS ENUM('receivable', 'payable');--> statement-breakpoint
CREATE TYPE "public"."lending_repayment_style" AS ENUM('lump_sum', 'installment');--> statement-breakpoint
CREATE TABLE "lendings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"counterparty_name" text NOT NULL,
	"kind" "lending_kind" NOT NULL,
	"principal_cents" integer NOT NULL,
	"currency" "transaction_currency" DEFAULT 'USD' NOT NULL,
	"repayment_style" "lending_repayment_style" DEFAULT 'lump_sum' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lending_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lending_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lendings" ADD CONSTRAINT "lendings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending_payments" ADD CONSTRAINT "lending_payments_lending_id_lendings_id_fk" FOREIGN KEY ("lending_id") REFERENCES "public"."lendings"("id") ON DELETE cascade ON UPDATE no action;

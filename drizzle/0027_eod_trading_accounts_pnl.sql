CREATE TABLE "eod_trading_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"initial_capital_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eod_trading_account" ADD CONSTRAINT "eod_trading_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eod_trading_account_user_id_idx" ON "eod_trading_account" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "eod_trading_account_user_name" ON "eod_trading_account" ("user_id","name");--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "trading_account_id" uuid;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "net_pnl_cents" integer;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD CONSTRAINT "eod_tracker_row_trading_account_id_eod_trading_account_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."eod_trading_account"("id") ON DELETE set null ON UPDATE no action;

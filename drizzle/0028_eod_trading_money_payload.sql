ALTER TABLE "eod_trading_account" ALTER COLUMN "initial_capital_cents" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "eod_trading_account" ADD COLUMN "initial_capital_payload" text;
--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "net_pnl_payload" text;

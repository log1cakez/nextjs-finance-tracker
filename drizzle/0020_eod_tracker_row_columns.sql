ALTER TABLE "eod_tracker_row" ADD COLUMN "trade_date" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "session" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "timeframe_eof_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "poi_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "trend" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "position" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "risk_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "result_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "rrr" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "time_range" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "entry_tf" text DEFAULT '' NOT NULL;
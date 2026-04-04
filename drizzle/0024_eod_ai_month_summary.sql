CREATE TABLE IF NOT EXISTS "eod_ai_month_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year_month" text NOT NULL,
	"summary_text" text NOT NULL,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"period_label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "eod_ai_month_summary" ADD CONSTRAINT "eod_ai_month_summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eod_ai_month_summary_user_ym" ON "eod_ai_month_summary" USING btree ("user_id","year_month");

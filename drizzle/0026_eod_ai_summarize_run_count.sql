ALTER TABLE "eod_ai_month_summary" ADD COLUMN IF NOT EXISTS "ai_summarize_run_count" integer DEFAULT 0 NOT NULL;

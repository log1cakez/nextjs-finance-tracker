ALTER TABLE "eod_tracker_row" ADD COLUMN "notion_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" DROP CONSTRAINT "eod_tracker_row_note_page_id_eod_notes_page_id_fk";--> statement-breakpoint
ALTER TABLE "eod_tracker_row" DROP COLUMN "note_page_id";--> statement-breakpoint
DROP TABLE "eod_notes_page";

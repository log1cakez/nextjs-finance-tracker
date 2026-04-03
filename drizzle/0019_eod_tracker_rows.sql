CREATE TABLE "eod_tracker_row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"note_page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD CONSTRAINT "eod_tracker_row_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD CONSTRAINT "eod_tracker_row_note_page_id_eod_notes_page_id_fk" FOREIGN KEY ("note_page_id") REFERENCES "public"."eod_notes_page"("id") ON DELETE set null ON UPDATE no action;
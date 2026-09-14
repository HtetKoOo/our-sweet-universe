ALTER TABLE "jar_notes" ADD COLUMN "open_when" text;--> statement-breakpoint
CREATE INDEX "jar_creator_idx" ON "jar_notes" USING btree ("couple_id","created_by");--> statement-breakpoint
CREATE TABLE "jar_note_opens" (
  "note_id" uuid NOT NULL,
  "opened_by" text NOT NULL,
  "reaction" text,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reacted_at" timestamp with time zone,
  CONSTRAINT "jar_note_opens_note_id_opened_by_pk" PRIMARY KEY("note_id","opened_by"),
  CONSTRAINT "jar_note_opens_reaction_check" CHECK ("reaction" in ('heart','hug','smile') or "reaction" is null)
);--> statement-breakpoint
ALTER TABLE "jar_note_opens" ADD CONSTRAINT "jar_note_opens_note_id_jar_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."jar_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jar_note_opens" ADD CONSTRAINT "jar_note_opens_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jar_opened_by_idx" ON "jar_note_opens" USING btree ("opened_by","opened_at");

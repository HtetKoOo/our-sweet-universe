ALTER TABLE "user" ADD COLUMN "birthday" date;--> statement-breakpoint
CREATE TABLE "couple_event_emails" (
  "couple_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "event_key" text NOT NULL,
  "event_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "couple_event_emails_couple_id_user_id_event_key_event_date_pk" PRIMARY KEY("couple_id","user_id","event_key","event_date")
);--> statement-breakpoint
ALTER TABLE "couple_event_emails" ADD CONSTRAINT "couple_event_emails_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_event_emails" ADD CONSTRAINT "couple_event_emails_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "couple_event_emails_date_idx" ON "couple_event_emails" USING btree ("couple_id","event_date");

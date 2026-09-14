CREATE TABLE "letter_reads" (
  "letter_id" uuid NOT NULL,
  "read_by" text NOT NULL,
  "read_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "letter_reads_letter_id_read_by_pk" PRIMARY KEY("letter_id","read_by")
);--> statement-breakpoint
ALTER TABLE "letter_reads" ADD CONSTRAINT "letter_reads_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_reads" ADD CONSTRAINT "letter_reads_read_by_user_id_fk" FOREIGN KEY ("read_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letter_reads_reader_idx" ON "letter_reads" USING btree ("read_by","read_at");

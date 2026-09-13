CREATE TABLE "little_question_reminders" (
	"round_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "little_question_reminders_round_id_user_id_pk" PRIMARY KEY("round_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "little_question_reminders" ADD CONSTRAINT "little_question_reminders_round_id_little_question_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."little_question_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "little_question_reminders" ADD CONSTRAINT "little_question_reminders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "little_question_reminders_user_idx" ON "little_question_reminders" USING btree ("user_id","created_at");
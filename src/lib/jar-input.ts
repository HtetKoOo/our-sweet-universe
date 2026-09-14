import { z } from "zod";

export const jarOpenWhenOptions = ["miss me", "need a smile", "today feels heavy", "a quiet night", "just because"] as const;

export const jarNoteInput = z.object({
  body: z.string().trim().min(1, "Write a little note first.").max(500, "Keep this one under 500 characters."),
  openWhen: z.union([z.literal(""), z.enum(jarOpenWhenOptions)]).transform((value) => value || null),
});

export const jarOpenInput = z.object({
  openWhen: z.union([z.literal(""), z.enum(jarOpenWhenOptions)]).transform((value) => value || null),
});

export const jarReactionInput = z.object({
  noteId: z.uuid(),
  reaction: z.enum(["heart", "hug", "smile"]),
});

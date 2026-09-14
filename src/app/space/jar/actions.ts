"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { jarNoteOpens, jarNotes } from "@/lib/db/schema";
import { jarNoteInput, jarOpenInput, jarReactionInput } from "@/lib/jar-input";

export type JarActionState = {
  message: string;
  opened?: { id: string; body: string; openWhen: string | null; reaction: "heart" | "hug" | "smile" | null };
};

export async function tuckJarNote(_previous: JarActionState, form: FormData): Promise<JarActionState> {
  const actor = await requireCouple();
  const parsed = jarNoteInput.safeParse({ body: form.get("body"), openWhen: form.get("openWhen") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Please check your note." };
  try {
    await getDb().insert(jarNotes).values({ coupleId: actor.coupleId, createdBy: actor.userId, ...parsed.data });
  } catch (error) {
    console.error("jar-note-save-failed", error);
    return { message: "Your note is still here. Please try again." };
  }
  revalidatePath("/space/jar");
  return { message: "Tucked away for a small surprise later." };
}

export async function openJarNote(_previous: JarActionState, form: FormData): Promise<JarActionState> {
  const actor = await requireCouple();
  const parsed = jarOpenInput.safeParse({ openWhen: form.get("openWhen") });
  if (!parsed.success) return { message: "Please choose a feeling again." };
  const db = getDb();
  // Only notes from the other member that this person has not discovered are
  // eligible. The insert below is the final guard against two quick taps.
  const candidates = await db.select({ id: jarNotes.id, body: jarNotes.body, openWhen: jarNotes.openWhen })
    .from(jarNotes)
    .where(and(eq(jarNotes.coupleId, actor.coupleId), ne(jarNotes.createdBy, actor.userId), parsed.data.openWhen ? eq(jarNotes.openWhen, parsed.data.openWhen) : undefined, sql`not exists (select 1 from jar_note_opens where jar_note_opens.note_id=${jarNotes.id} and jar_note_opens.opened_by=${actor.userId})`))
    .orderBy(sql`random()`)
    .limit(1);
  const note = candidates[0];
  if (!note) return { message: parsed.data.openWhen ? "No unopened note is waiting for that feeling yet." : "No unopened note is waiting right now. Leave your person a little one for later." };
  const [opened] = await db.insert(jarNoteOpens).values({ noteId: note.id, openedBy: actor.userId }).onConflictDoNothing().returning({ noteId: jarNoteOpens.noteId });
  if (!opened) return { message: "That little note was just opened. Try once more." };
  revalidatePath("/space/jar");
  return { message: "A little surprise found you.", opened: { ...note, reaction: null } };
}

export async function reactToJarNote(_previous: JarActionState, form: FormData): Promise<JarActionState> {
  const actor = await requireCouple();
  const parsed = jarReactionInput.safeParse({ noteId: form.get("noteId"), reaction: form.get("reaction") });
  if (!parsed.success) return { message: "That reaction couldn’t be saved." };
  const changed = await getDb().update(jarNoteOpens).set({ reaction: parsed.data.reaction, reactedAt: new Date() })
    .where(and(eq(jarNoteOpens.noteId, parsed.data.noteId), eq(jarNoteOpens.openedBy, actor.userId)))
    .returning({ noteId: jarNoteOpens.noteId });
  if (!changed.length) return { message: "This note is no longer available." };
  revalidatePath("/space/jar");
  return { message: "A little feeling sent back." };
}

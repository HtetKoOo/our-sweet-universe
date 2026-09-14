import { and, desc, eq, ne, sql } from "drizzle-orm";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { jarNoteOpens, jarNotes } from "@/lib/db/schema";
import { LittleJar } from "@/components/little-jar";

export default async function JarPage() {
  const actor = await requireCouple();
  const db = getDb();
  const [waiting, tucked, recentOpened] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(jarNotes).where(and(eq(jarNotes.coupleId, actor.coupleId), ne(jarNotes.createdBy, actor.userId), sql`not exists (select 1 from jar_note_opens where jar_note_opens.note_id=${jarNotes.id} and jar_note_opens.opened_by=${actor.userId})`)),
    db.select({ count: sql<number>`count(*)::int` }).from(jarNotes).where(and(eq(jarNotes.coupleId, actor.coupleId), eq(jarNotes.createdBy, actor.userId), sql`not exists (select 1 from jar_note_opens where jar_note_opens.note_id=${jarNotes.id})`)),
    db.select({ id: jarNotes.id, body: jarNotes.body, openWhen: jarNotes.openWhen, reaction: jarNoteOpens.reaction }).from(jarNoteOpens).innerJoin(jarNotes, eq(jarNoteOpens.noteId, jarNotes.id)).where(and(eq(jarNoteOpens.openedBy, actor.userId), eq(jarNotes.coupleId, actor.coupleId))).orderBy(desc(jarNoteOpens.openedAt)).limit(3),
  ]);
  return <LittleJar waitingCount={waiting[0]?.count ?? 0} tuckedCount={tucked[0]?.count ?? 0} recentOpened={recentOpened} />;
}

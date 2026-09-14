import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { letters } from "@/lib/db/schema";
import { LetterReadMarker } from "@/components/letter-read-marker";

export default async function LetterDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCouple(); const { id } = await params;
  const [letter] = await getDb().select({ id: letters.id, title: letters.title, body: letters.body, createdAt: letters.createdAt, createdBy: letters.createdBy }).from(letters).where(and(eq(letters.id, id), eq(letters.coupleId, actor.coupleId))).limit(1);
  if (!letter) notFound();
  const received = letter.createdBy !== actor.userId;
  return <section className="letter-detail"><LetterReadMarker id={letter.id} shouldMark={received} /><Link href="/space/letters" className="quiet-link">← Back to letters</Link><article><span className="letter-seal"><Mail aria-hidden="true" /></span><p className="eyebrow">{received ? "A LETTER FROM YOUR PERSON" : "A LETTER YOU WROTE"}</p><h1>{letter.title}</h1><time dateTime={letter.createdAt.toISOString()}>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(letter.createdAt)}</time><div className="letter-body">{letter.body}</div></article></section>;
}

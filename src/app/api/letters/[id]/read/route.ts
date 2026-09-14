import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { letterReads, letters } from "@/lib/db/schema";
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCouple(); const { id } = await params;
  const [letter] = await getDb().select({ id: letters.id }).from(letters).where(and(eq(letters.id, id), eq(letters.coupleId, actor.coupleId), ne(letters.createdBy, actor.userId))).limit(1);
  if (!letter) return NextResponse.json({ ok: false }, { status: 404 });
  await getDb().insert(letterReads).values({ letterId: id, readBy: actor.userId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

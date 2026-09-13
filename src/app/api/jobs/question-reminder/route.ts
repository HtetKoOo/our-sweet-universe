import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  coupleMembers,
  couples,
  littleQuestionAnswers,
  littleQuestionReminders,
  littleQuestionRounds,
  user,
} from "@/lib/db/schema";
import { calendarDate, localClock } from "@/lib/dates";
import { sendLittleQuestionReminder } from "@/lib/email";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const expected = process.env.QUESTION_REMINDER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const now = new Date();
  const rounds = await db
    .select({ id: littleQuestionRounds.id, coupleId: littleQuestionRounds.coupleId, questionDay: littleQuestionRounds.questionDay, timezone: couples.timezone })
    .from(littleQuestionRounds)
    .innerJoin(couples, eq(littleQuestionRounds.coupleId, couples.id))
    .where(eq(littleQuestionRounds.status, "answering"));

  let sent = 0;
  for (const round of rounds) {
    const { hour, minute } = localClock(now, round.timezone);
    if (hour !== 11 || minute < 30 || round.questionDay >= calendarDate(now, round.timezone)) continue;

    const [members, answers] = await Promise.all([
      db
        .select({ id: user.id, email: user.email })
        .from(coupleMembers)
        .innerJoin(user, eq(coupleMembers.userId, user.id))
        .where(and(eq(coupleMembers.coupleId, round.coupleId), eq(user.emailVerified, true))),
      db.select({ userId: littleQuestionAnswers.userId }).from(littleQuestionAnswers).where(eq(littleQuestionAnswers.roundId, round.id)),
    ]);
    if (members.length !== 2) continue;
    const answeredBy = new Set(answers.map((answer) => answer.userId));

    for (const member of members) {
      if (answeredBy.has(member.id)) continue;
      const [reminder] = await db
        .insert(littleQuestionReminders)
        .values({ roundId: round.id, userId: member.id })
        .onConflictDoNothing()
        .returning({ userId: littleQuestionReminders.userId });
      if (!reminder) continue;
      try {
        await sendLittleQuestionReminder({ to: member.email });
        sent += 1;
      } catch (error) {
        await db.delete(littleQuestionReminders).where(and(eq(littleQuestionReminders.roundId, round.id), eq(littleQuestionReminders.userId, member.id)));
        console.error("little-question-reminder-failed", error);
      }
    }
  }

  return NextResponse.json({ sent });
}

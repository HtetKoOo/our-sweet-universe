import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  coupleEventEmails,
  coupleMembers,
  couples,
  user,
} from "@/lib/db/schema";
import { calendarDate, localClock } from "@/lib/dates";
import {
  sendAnniversaryEmail,
  sendBirthdayEmail,
  sendMonthsaryEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const expected = process.env.QUESTION_REMINDER_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function anniversaryDate(year: number, start: string) {
  const { month, day } = dateParts(start);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

async function reserveDelivery(
  coupleId: string,
  userId: string,
  eventKey: string,
  eventDate: string,
) {
  const [delivery] = await getDb()
    .insert(coupleEventEmails)
    .values({ coupleId, userId, eventKey, eventDate })
    .onConflictDoNothing()
    .returning({ userId: coupleEventEmails.userId });
  return Boolean(delivery);
}

async function sendReserved({
  coupleId,
  userId,
  eventKey,
  eventDate,
  send,
}: {
  coupleId: string;
  userId: string;
  eventKey: string;
  eventDate: string;
  send: () => Promise<void>;
}) {
  if (!(await reserveDelivery(coupleId, userId, eventKey, eventDate)))
    return false;
  try {
    await send();
    return true;
  } catch (error) {
    await getDb()
      .delete(coupleEventEmails)
      .where(
        and(
          eq(coupleEventEmails.coupleId, coupleId),
          eq(coupleEventEmails.userId, userId),
          eq(coupleEventEmails.eventKey, eventKey),
          eq(coupleEventEmails.eventDate, eventDate),
        ),
      );
    console.error("celebration-email-failed", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const rows = await getDb()
    .select({
      coupleId: couples.id,
      coupleName: couples.name,
      togetherSince: couples.togetherSince,
      timezone: couples.timezone,
      userId: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      birthday: user.birthday,
    })
    .from(couples)
    .innerJoin(coupleMembers, eq(coupleMembers.coupleId, couples.id))
    .innerJoin(user, eq(coupleMembers.userId, user.id));
  const byCouple = new Map<string, typeof rows>();
  for (const row of rows)
    byCouple.set(row.coupleId, [...(byCouple.get(row.coupleId) ?? []), row]);

  let sent = 0;
  for (const members of byCouple.values()) {
    if (members.length !== 2 || members.some((member) => !member.emailVerified))
      continue;
    const couple = members[0]!;
    const clock = localClock(now, couple.timezone);
    if (clock.hour !== 6) continue;
    const today = calendarDate(now, couple.timezone);
    const start = dateParts(couple.togetherSince);
    const current = dateParts(today);
    const isAnniversary =
      current.year > start.year &&
      today === anniversaryDate(current.year, couple.togetherSince);
    const sameDayOfMonth =
      today === anniversaryDate(current.year, couple.togetherSince);

    if (isAnniversary) {
      for (const member of members)
        if (
          await sendReserved({
            coupleId: couple.coupleId,
            userId: member.userId,
            eventKey: "anniversary",
            eventDate: today,
            send: () =>
              sendAnniversaryEmail({
                to: member.email,
                coupleName: couple.coupleName,
                years: current.year - start.year,
              }),
          })
        )
          sent++;
    } else if (sameDayOfMonth && today > couple.togetherSince) {
      for (const member of members)
        if (
          await sendReserved({
            coupleId: couple.coupleId,
            userId: member.userId,
            eventKey: "monthsary",
            eventDate: today,
            send: () =>
              sendMonthsaryEmail({
                to: member.email,
                coupleName: couple.coupleName,
              }),
          })
        )
          sent++;
    }

    for (const member of members) {
      if (!member.birthday || member.birthday.slice(5) !== today.slice(5))
        continue;
      for (const recipient of members) {
        if (
          await sendReserved({
            coupleId: couple.coupleId,
            userId: recipient.userId,
            eventKey: `birthday:${member.userId}`,
            eventDate: today,
            send: () =>
              sendBirthdayEmail({
                to: recipient.email,
                name: member.name,
                isOwnBirthday: recipient.userId === member.userId,
              }),
          })
        )
          sent++;
      }
    }
  }
  return NextResponse.json({ sent });
}

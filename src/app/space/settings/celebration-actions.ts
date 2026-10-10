"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { coupleEventEmails, coupleMembers, user } from "@/lib/db/schema";
import { calendarDate } from "@/lib/dates";
import { sendMonthsaryEmail } from "@/lib/email";

export type CelebrationResendState = { message: string };

function previousCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function monthsaryDate(year: number, month: number, date: string) {
  const [, , day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export async function resendMissedMonthsary(
  _previous: CelebrationResendState,
): Promise<CelebrationResendState> {
  void _previous;
  const actor = await requireCouple();
  if (actor.role !== "owner") return { message: "Only the owner can resend a shared celebration email." };

  const now = new Date();
  const today = calendarDate(now, actor.timezone);
  let missedDate = previousCalendarDate(today);
  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const candidate = daysAgo === 1 ? missedDate : previousCalendarDate(missedDate);
    missedDate = candidate;
    const candidateYear = Number(candidate.slice(0, 4));
    const candidateMonth = Number(candidate.slice(5, 7));
    const isMonthsary =
      candidate > actor.togetherSince &&
      candidate === monthsaryDate(candidateYear, candidateMonth, actor.togetherSince) &&
      !(candidateMonth === Number(actor.togetherSince.slice(5, 7)) && candidateYear > Number(actor.togetherSince.slice(0, 4)));
    if (isMonthsary) break;
    if (daysAgo === 7) return { message: "There isn’t a missed monthsary email from the last seven days to resend." };
  }

  const db = getDb();
  const members = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(coupleMembers)
    .innerJoin(user, eq(coupleMembers.userId, user.id))
    .where(eq(coupleMembers.coupleId, actor.coupleId));
  if (members.length !== 2 || members.some((member) => !member.emailVerified))
    return { message: "Both members need verified email addresses before this can be resent." };

  let sent = 0;
  for (const member of members) {
    const [reserved] = await db
      .insert(coupleEventEmails)
      .values({
        coupleId: actor.coupleId,
        userId: member.id,
        eventKey: "monthsary-manual",
        eventDate: missedDate,
      })
      .onConflictDoNothing()
      .returning({ userId: coupleEventEmails.userId });
    if (!reserved) continue;
    try {
      await sendMonthsaryEmail({ to: member.email, coupleName: actor.name });
      sent += 1;
    } catch (error) {
      await db
        .delete(coupleEventEmails)
        .where(
          and(
            eq(coupleEventEmails.coupleId, actor.coupleId),
            eq(coupleEventEmails.userId, member.id),
            eq(coupleEventEmails.eventKey, "monthsary-manual"),
            eq(coupleEventEmails.eventDate, missedDate),
          ),
        );
      console.error("manual-monthsary-email-failed", { coupleId: actor.coupleId, userId: member.id, error });
    }
  }
  revalidatePath("/space/settings");
  if (sent === 2) return { message: "The missed monthsary email is on its way to both of you." };
  if (sent === 1) return { message: "The monthsary email was sent to one person. Please try again for the other." };
  return { message: "This monthsary email was already resent, or it could not be sent. Check the email provider logs before trying again." };
}

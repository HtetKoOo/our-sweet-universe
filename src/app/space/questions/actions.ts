"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import {
  coupleMembers,
  littleQuestionAnswers,
  littleQuestionRounds,
  user,
} from "@/lib/db/schema";
import {
  findQuestionRoundForActor,
  revealWhenBothAnswered,
} from "@/lib/little-questions";
import { sendRestRequestEmail } from "@/lib/email";
import {
  littleQuestionActionInput,
  type LittleQuestionActionState,
} from "@/lib/little-question-input";

export async function actOnLittleQuestion(
  _previous: LittleQuestionActionState,
  form: FormData,
): Promise<LittleQuestionActionState> {
  const actor = await requireCouple();
  const parsed = littleQuestionActionInput.safeParse({
    roundId: form.get("roundId"),
    intent: form.get("intent"),
    body: form.get("body"),
  });
  if (!parsed.success) return { message: "Please try that question again." };

  const round = await findQuestionRoundForActor(actor, parsed.data.roundId);
  if (!round) return { message: "That question is no longer available." };
  const db = getDb();
  const now = new Date();

  if (parsed.data.intent === "answer") {
    const body = parsed.data.body?.trim();
    if (!body) return { message: "Write a little answer first." };
    if (round.status === "revealed" || round.status === "rested")
      return { message: "This question is already complete." };
    try {
      await db
        .insert(littleQuestionAnswers)
        .values({ roundId: round.id, userId: actor.userId, body })
        .onConflictDoUpdate({
          target: [littleQuestionAnswers.roundId, littleQuestionAnswers.userId],
          set: { body, updatedAt: now },
        });
      await revealWhenBothAnswered(actor, round.id);
    } catch (error) {
      console.error("little-question-answer-failed", error);
      return {
        message: "Your answer is still here. Please try saving it again.",
      };
    }
    revalidatePath("/space/questions");
    revalidatePath("/space/more");
    return { message: "Your answer is safely tucked away." };
  }

  if (parsed.data.intent === "request-rest") {
    if (round.status !== "decision")
      return { message: "This question is still in its answer time." };
    const changed = await db
      .update(littleQuestionRounds)
      .set({
        status: "rest_requested",
        restRequestedBy: actor.userId,
        restRequestedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(littleQuestionRounds.id, round.id),
          eq(littleQuestionRounds.coupleId, actor.coupleId),
          eq(littleQuestionRounds.status, "decision"),
        ),
      )
      .returning({ id: littleQuestionRounds.id });
    if (!changed.length)
      return { message: "That question just changed. Please check it again." };
    try {
      const [partner] = await db
        .select({
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        })
        .from(coupleMembers)
        .innerJoin(user, eq(coupleMembers.userId, user.id))
        .where(
          and(
            eq(coupleMembers.coupleId, actor.coupleId),
            sql`${coupleMembers.userId} <> ${actor.userId}`,
          ),
        )
        .limit(1);
      if (partner?.emailVerified)
        await sendRestRequestEmail({ to: partner.email });
    } catch (error) {
      console.error("rest-request-email-failed", error);
    }
    revalidatePath("/space/questions");
    return { message: "Your request is waiting for your person." };
  }

  if (round.status !== "rest_requested" || !round.restRequestedBy)
    return { message: "There is no rest request to respond to." };
  if (round.restRequestedBy === actor.userId)
    return { message: "Your person needs to respond to this request." };

  if (parsed.data.intent === "approve-rest") {
    await db
      .update(littleQuestionRounds)
      .set({ status: "rested", restedAt: now, updatedAt: now })
      .where(
        and(
          eq(littleQuestionRounds.id, round.id),
          eq(littleQuestionRounds.coupleId, actor.coupleId),
          eq(littleQuestionRounds.status, "rest_requested"),
        ),
      );
    revalidatePath("/space/questions");
    return {
      message: "This one can rest. A new question will come at the next noon.",
    };
  }

  if (parsed.data.intent === "decline-rest") {
    await db
      .update(littleQuestionRounds)
      .set({
        status: "decision",
        restRequestedBy: null,
        restRequestedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(littleQuestionRounds.id, round.id),
          eq(littleQuestionRounds.coupleId, actor.coupleId),
          eq(littleQuestionRounds.status, "rest_requested"),
        ),
      );
    revalidatePath("/space/questions");
    return { message: "No rush. This question will stay here for now." };
  }

  return { message: "Please try that again." };
}

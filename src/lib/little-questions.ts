import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireCouple } from "./authorization";
import { calendarDate, isQuestionTime, localClock } from "./dates";
import { getDb } from "./db";
import {
  littleQuestionAnswers,
  littleQuestionBank,
  littleQuestionRounds,
  littleQuestionViews,
} from "./db/schema";

type Actor = Awaited<ReturnType<typeof requireCouple>>;
type RoundStatus = "answering" | "decision" | "rest_requested" | "revealed" | "rested";

export type LittleQuestionView = {
  phase: "waiting" | "answering" | "decision" | "rest_requested" | "revealed" | "rested";
  question: {
    id: string;
    prompt: string;
    questionDay: string;
    status: RoundStatus;
  } | null;
  ownAnswer: string | null;
  answers: { body: string; isOwn: boolean }[];
  answerCount: number;
  restRequestedByMe: boolean;
  nearDecisionTime: boolean;
  timezone: string;
};

export type QuestionHistoryItem = {
  id: string;
  questionDay: string;
  prompt: string;
};

export type QuestionHistoryPage = {
  items: QuestionHistoryItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type CompletedLittleQuestion = QuestionHistoryItem & {
  ownAnswer: string;
  partnerAnswer: string;
};

async function latestRound(actor: Actor) {
  const [round] = await getDb()
    .select({
      id: littleQuestionRounds.id,
      questionDay: littleQuestionRounds.questionDay,
      status: littleQuestionRounds.status,
      restRequestedBy: littleQuestionRounds.restRequestedBy,
      revealedAt: littleQuestionRounds.revealedAt,
      restedAt: littleQuestionRounds.restedAt,
      prompt: littleQuestionBank.prompt,
    })
    .from(littleQuestionRounds)
    .innerJoin(
      littleQuestionBank,
      eq(littleQuestionRounds.questionId, littleQuestionBank.id),
    )
    .where(eq(littleQuestionRounds.coupleId, actor.coupleId))
    .orderBy(desc(littleQuestionRounds.questionDay), desc(littleQuestionRounds.id))
    .limit(1);
  return round ?? null;
}

async function answerCount(roundId: string) {
  const rows = await getDb()
    .select({ id: littleQuestionAnswers.id })
    .from(littleQuestionAnswers)
    .where(eq(littleQuestionAnswers.roundId, roundId));
  return rows.length;
}

async function chooseQuestion(coupleId: string) {
  const db = getDb();
  const used = await db
    .select({ questionId: littleQuestionRounds.questionId })
    .from(littleQuestionRounds)
    .where(eq(littleQuestionRounds.coupleId, coupleId));
  const usedIds = new Set(used.map((row) => row.questionId));
  const all = await db
    .select({ id: littleQuestionBank.id })
    .from(littleQuestionBank)
    .where(eq(littleQuestionBank.isActive, true))
    .orderBy(littleQuestionBank.sortOrder);
  const choices = all.filter((question) => !usedIds.has(question.id));
  const pool = choices.length ? choices : all;
  if (!pool.length) throw new Error("The little question bank is empty.");
  return pool[Math.floor(Math.random() * pool.length)]!;
}

async function createTodayRound(actor: Actor, questionDay: string) {
  const question = await chooseQuestion(actor.coupleId);
  await getDb()
    .insert(littleQuestionRounds)
    .values({ coupleId: actor.coupleId, questionId: question.id, questionDay })
    .onConflictDoNothing();
}

async function reconcileRound(actor: Actor, now: Date) {
  let round = await latestRound(actor);
  const today = calendarDate(now, actor.timezone);
  const afterNoon = isQuestionTime(now, actor.timezone);

  if (!round && afterNoon) {
    await createTodayRound(actor, today);
    return latestRound(actor);
  }
  if (!round) return null;

  const count = await answerCount(round.id);
  if (count >= 2 && round.status !== "revealed" && round.status !== "rested") {
    await getDb()
      .update(littleQuestionRounds)
      .set({
        status: "revealed",
        revealedAt: now,
        restRequestedBy: null,
        restRequestedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(littleQuestionRounds.id, round.id),
          eq(littleQuestionRounds.coupleId, actor.coupleId),
        ),
      );
    round = await latestRound(actor);
  }

  if (round && round.status === "answering" && round.questionDay < today && afterNoon) {
    await getDb()
      .update(littleQuestionRounds)
      .set({ status: "decision", updatedAt: now })
      .where(
        and(
          eq(littleQuestionRounds.id, round.id),
          eq(littleQuestionRounds.coupleId, actor.coupleId),
          eq(littleQuestionRounds.status, "answering"),
        ),
      );
    round = await latestRound(actor);
  }

  if (!round || (round.status !== "revealed" && round.status !== "rested"))
    return round;

  const resolvedAt = round.revealedAt ?? round.restedAt;
  const resolvedDay = resolvedAt ? calendarDate(resolvedAt, actor.timezone) : today;
  // A prompt resolved before today's noon may make room for today's prompt.
  // Resolving after noon always leaves a quiet gap until tomorrow.
  const canStartToday =
    afterNoon &&
    (resolvedDay < today ||
      (resolvedDay === today && !isQuestionTime(resolvedAt ?? now, actor.timezone)));
  if (canStartToday) {
    await createTodayRound(actor, today);
    round = await latestRound(actor);
  }
  return round;
}

export async function getLittleQuestionView(): Promise<LittleQuestionView> {
  const actor = await requireCouple();
  const round = await reconcileRound(actor, new Date());
  if (!round)
    return {
      phase: "waiting",
      question: null,
      ownAnswer: null,
      answers: [],
      answerCount: 0,
      restRequestedByMe: false,
      nearDecisionTime: false,
      timezone: actor.timezone,
    };

  const allAnswers = await getDb()
    .select({ userId: littleQuestionAnswers.userId, body: littleQuestionAnswers.body })
    .from(littleQuestionAnswers)
    .where(eq(littleQuestionAnswers.roundId, round.id));
  const own = allAnswers.find((answer) => answer.userId === actor.userId)?.body ?? null;
  const phase = round.status as LittleQuestionView["phase"];
  const { hour, minute } = localClock(new Date(), actor.timezone);
  const today = calendarDate(new Date(), actor.timezone);
  const nearDecisionTime =
    phase === "answering" &&
    !own &&
    round.questionDay < today &&
    hour === 11 &&
    minute >= 30;
  return {
    phase,
    question: {
      id: round.id,
      prompt: round.prompt,
      questionDay: round.questionDay,
      status: round.status as RoundStatus,
    },
    ownAnswer: own,
    // The other answer is deliberately never serialized before reveal.
    answers:
      round.status === "revealed"
        ? allAnswers.map((answer) => ({
            body: answer.body,
            isOwn: answer.userId === actor.userId,
          }))
        : [],
    answerCount: allAnswers.length,
    restRequestedByMe: round.restRequestedBy === actor.userId,
    nearDecisionTime,
    timezone: actor.timezone,
  };
}

export async function markLittleQuestionSeen(roundId: string) {
  const actor = await requireCouple();
  const round = await findQuestionRoundForActor(actor, roundId);
  if (!round) return false;
  await getDb()
    .insert(littleQuestionViews)
    .values({ roundId, userId: actor.userId })
    .onConflictDoNothing();
  return true;
}

export async function getCompletedLittleQuestionCount() {
  const actor = await requireCouple();
  const [result] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(littleQuestionRounds)
    .where(and(eq(littleQuestionRounds.coupleId, actor.coupleId), eq(littleQuestionRounds.status, "revealed")));
  return result?.count ?? 0;
}

export async function getLittleQuestionHistoryPage(page = 1, perPage = 20): Promise<QuestionHistoryPage> {
  const actor = await requireCouple();
  const safePage = Math.max(1, Math.floor(page));
  const db = getDb();
  const [countResult, items] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(littleQuestionRounds)
      .where(and(eq(littleQuestionRounds.coupleId, actor.coupleId), eq(littleQuestionRounds.status, "revealed"))),
    db.select({ id: littleQuestionRounds.id, questionDay: littleQuestionRounds.questionDay, prompt: littleQuestionBank.prompt })
      .from(littleQuestionRounds).innerJoin(littleQuestionBank, eq(littleQuestionRounds.questionId, littleQuestionBank.id))
      .where(and(eq(littleQuestionRounds.coupleId, actor.coupleId), eq(littleQuestionRounds.status, "revealed")))
      .orderBy(desc(littleQuestionRounds.questionDay), desc(littleQuestionRounds.id))
      .limit(perPage).offset((safePage - 1) * perPage),
  ]);
  const total = countResult[0]?.count ?? 0;
  return { items, total, page: safePage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getCompletedLittleQuestion(id: string): Promise<CompletedLittleQuestion | null> {
  const actor = await requireCouple();
  const [round] = await getDb().select({ id: littleQuestionRounds.id, questionDay: littleQuestionRounds.questionDay, prompt: littleQuestionBank.prompt })
    .from(littleQuestionRounds).innerJoin(littleQuestionBank, eq(littleQuestionRounds.questionId, littleQuestionBank.id))
    .where(and(eq(littleQuestionRounds.id, id), eq(littleQuestionRounds.coupleId, actor.coupleId), eq(littleQuestionRounds.status, "revealed"))).limit(1);
  if (!round) return null;
  const answers = await getDb().select({ userId: littleQuestionAnswers.userId, body: littleQuestionAnswers.body })
    .from(littleQuestionAnswers).where(eq(littleQuestionAnswers.roundId, round.id));
  const ownAnswer = answers.find((answer) => answer.userId === actor.userId)?.body;
  const partnerAnswer = answers.find((answer) => answer.userId !== actor.userId)?.body;
  return ownAnswer && partnerAnswer ? { ...round, ownAnswer, partnerAnswer } : null;
}

export async function findQuestionRoundForActor(actor: Actor, roundId: string) {
  const [round] = await getDb()
    .select()
    .from(littleQuestionRounds)
    .where(
      and(
        eq(littleQuestionRounds.id, roundId),
        eq(littleQuestionRounds.coupleId, actor.coupleId),
      ),
    )
    .limit(1);
  return round ?? null;
}

export async function revealWhenBothAnswered(actor: Actor, roundId: string) {
  await getDb().execute(sql`
    update little_question_rounds
    set status='revealed', revealed_at=now(), rest_requested_by=null,
        rest_requested_at=null, updated_at=now()
    where id=${roundId}::uuid and couple_id=${actor.coupleId}::uuid
      and status in ('answering', 'decision', 'rest_requested')
      and (select count(*) from little_question_answers where round_id=${roundId}::uuid) >= 2
  `);
}

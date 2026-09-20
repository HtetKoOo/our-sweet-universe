"use client";

import { useActionState, useEffect, useState } from "react";
import { BellRing, Clock3, HeartHandshake, LockKeyhole, MessageCircleHeart, Pause, Sparkles } from "lucide-react";
import { actOnLittleQuestion } from "@/app/space/questions/actions";
import type { LittleQuestionActionState } from "@/lib/little-question-input";
import type { LittleQuestionView } from "@/lib/little-questions";
import { calendarDate, localClock } from "@/lib/dates";

const initial: LittleQuestionActionState = { message: "" };

function SubmitButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return <button className={secondary ? "question-secondary" : "button"} type="submit">{children}</button>;
}

export function LittleQuestionCard({ question }: { question: LittleQuestionView }) {
  const [state, action, pending] = useActionState(actOnLittleQuestion, initial);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!question.question || question.phase !== "answering" || question.ownAnswer) return;
    const interval = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [question.ownAnswer, question.phase, question.question]);
  if (question.phase === "waiting") {
    return <section className="little-question-card little-question-waiting"><Sparkles aria-hidden="true" /><p className="eyebrow">ONE LITTLE QUESTION</p><h1>See you at noon.</h1><p>One shared question arrives here at 12:00 in your couple timezone.</p></section>;
  }
  if (!question.question) return null;
  const { id, prompt } = question.question;
  const message = <p className="question-status" role="status">{state.message}</p>;

  if (question.phase === "revealed") {
    return <section className="little-question-card little-question-revealed"><div className="question-icon"><HeartHandshake aria-hidden="true" /></div><p className="eyebrow">ANSWERED TOGETHER</p><h1>One little question.</h1><blockquote>{prompt}</blockquote><div className="question-answers"><article><small>Your answer</small><p>{question.answers.find((answer) => answer.isOwn)?.body}</p></article><article><small>Your person’s answer</small><p>{question.answers.find((answer) => !answer.isOwn)?.body}</p></article></div>{message}</section>;
  }

  if (question.phase === "rested") {
    return <section className="little-question-card little-question-rested"><div className="question-icon"><Pause aria-hidden="true" /></div><p className="eyebrow">GIVEN A LITTLE REST</p><h1>This one can wait.</h1><blockquote>{prompt}</blockquote><p>No answers were shared. Your next little question will arrive at noon.</p>{message}</section>;
  }

  if (question.phase === "rest_requested") {
    if (question.restRequestedByMe) return <section className="little-question-card"><div className="question-icon"><MessageCircleHeart aria-hidden="true" /></div><p className="eyebrow">ONE LITTLE QUESTION</p><h1>Giving it some room.</h1><blockquote>{prompt}</blockquote><p>You asked to let this question rest. It will stay private while you wait for your person.</p>{message}</section>;
    return <section className="little-question-card"><div className="question-icon"><HeartHandshake aria-hidden="true" /></div><p className="eyebrow">A SMALL CHECK-IN</p><h1>Let this one rest?</h1><blockquote>{prompt}</blockquote><p>Your person would like to let this question rest. No answer is revealed either way.</p><form action={action} className="question-actions"><input type="hidden" name="roundId" value={id} /><button type="submit" name="intent" value="approve-rest" className="button" disabled={pending}>Let it rest</button><button type="submit" name="intent" value="decline-rest" className="question-secondary" disabled={pending}>I’ll answer later</button></form>{message}</section>;
  }

  const inDecision = question.phase === "decision";
  const partnerHasAnswered = !question.ownAnswer && question.answerCount === 1;
  const waitingForPartner = Boolean(question.ownAnswer) && question.answerCount === 1;
  const reminderNow = new Date(clock);
  const { hour: reminderHour, minute: reminderMinute } = localClock(reminderNow, question.timezone);
  const softReminder =
    question.phase === "answering" &&
    !question.ownAnswer &&
    question.question.questionDay < calendarDate(reminderNow, question.timezone) &&
    reminderHour === 11 &&
    reminderMinute >= 30;
  return <section className="little-question-card"><div className="question-icon"><MessageCircleHeart aria-hidden="true" /></div><p className="eyebrow">ONE LITTLE QUESTION</p><blockquote>{prompt}</blockquote><p className="question-rule"><LockKeyhole size={15} aria-hidden="true" /> Both answers open when you’ve both answered.</p>{softReminder ? <p className="question-soft-reminder"><BellRing size={18} aria-hidden="true" /><span><b>A little time remains.</b> There’s still room for your answer. After noon, you can answer or decide together to let this one rest.</span></p> : null}<form action={action} className="question-answer-form"><input type="hidden" name="roundId" value={id} /><input type="hidden" name="intent" value="answer" /><label htmlFor="little-question-answer">Your answer</label><textarea id="little-question-answer" name="body" defaultValue={question.ownAnswer ?? ""} maxLength={1200} rows={5} required disabled={pending} placeholder="Write whatever feels true today…" /><div className="question-actions"><SubmitButton>{pending ? "Saving…" : question.ownAnswer ? "Update my answer" : "Keep my answer"}</SubmitButton></div></form>{partnerHasAnswered ? <p className="question-answer-status"><HeartHandshake size={17} aria-hidden="true" /> Your person answered. Add yours to reveal both.</p> : null}{waitingForPartner ? <p className="question-answer-status"><Clock3 size={17} aria-hidden="true" /> <b>Saved.</b> Waiting for your person’s answer.</p> : null}{inDecision ? <><form action={action} className="question-rest-form"><input type="hidden" name="roundId" value={id} /><input type="hidden" name="intent" value="request-rest" /><button type="submit" className="question-secondary" disabled={pending}>Request to let this rest</button></form><p className="question-decision-note">You have had a full day with this question. You can answer now, or ask your person to let it rest.</p></> : null}{message}</section>;
}

import Link from "next/link";
import { ArrowLeft, HeartHandshake } from "lucide-react";
import { notFound } from "next/navigation";
import { getCompletedLittleQuestion } from "@/lib/little-questions";

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default async function QuestionHistoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const question = await getCompletedLittleQuestion(id);
  if (!question) notFound();
  return (
    <section className="question-history-detail">
      <article>
        <div className="question-history-detail-kicker">
          <Link
            className="question-history-inline-back"
            href="/space/questions/history"
            aria-label="Back to our answers"
          >
            <ArrowLeft size={16} strokeWidth={2.35} aria-hidden="true" />
          </Link>
          <p className="eyebrow">ANSWERED TOGETHER</p>
          <span aria-hidden="true" />
        </div>
        <span className="question-history-detail-icon">
          <HeartHandshake aria-hidden="true" />
        </span>
        <time dateTime={question.questionDay}>
          {displayDate(question.questionDay)}
        </time>
        <h1>{question.prompt}</h1>
        <div className="question-history-detail-answers">
          <section>
            <small>Your answer</small>
            <p>{question.ownAnswer}</p>
          </section>
          <section>
            <small>Your person’s answer</small>
            <p>{question.partnerAnswer}</p>
          </section>
        </div>
      </article>
    </section>
  );
}

import { LittleQuestionCard } from "@/components/little-question-card";
import { LittleQuestionHistory } from "@/components/little-question-history";
import { QuestionViewMarker } from "@/components/question-view-marker";
import {
  getCompletedLittleQuestionCount,
  getLittleQuestionView,
} from "@/lib/little-questions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const [question, historyCount] = await Promise.all([
    getLittleQuestionView(),
    getCompletedLittleQuestionCount(),
  ]);
  return (
    <>
      {question.question ? (
        <QuestionViewMarker roundId={question.question.id} />
      ) : null}
      <LittleQuestionCard question={question} />
      <LittleQuestionHistory count={historyCount} />
    </>
  );
}

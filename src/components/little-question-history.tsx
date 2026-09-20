import Link from "next/link";
import { BookHeart, ChevronRight } from "lucide-react";

export function LittleQuestionHistory({ count }: { count: number }) {
  return (
    <Link
      href="/space/questions/history"
      className="little-question-history-link"
    >
      <span className="little-question-history-link-icon">
        <BookHeart aria-hidden="true" />
      </span>
      <span>
        <small>KEPT TOGETHER</small>
        <strong>Our little answers</strong>
        <em>
          {count
            ? `${count} shared ${count === 1 ? "moment" : "moments"} to revisit.`
            : "The moments you answer together will live here."}
        </em>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

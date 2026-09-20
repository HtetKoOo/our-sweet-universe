import Link from "next/link";
import { ArrowLeft, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumber } from "@/lib/memory-input";
import { getLittleQuestionHistoryPage } from "@/lib/little-questions";

function displayDate(date: string) { return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)); }

export default async function QuestionHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  const history = await getLittleQuestionHistoryPage(pageNumber(page));
  return <section className="question-history-page"><Link className="question-history-page-back" href="/space/questions" aria-label="Back to today’s question"><ArrowLeft size={16} strokeWidth={2.35} aria-hidden="true" /></Link><header><h1>Our little answers.<span className="question-history-count" aria-label={`${history.total} saved answers`}><Heart aria-hidden="true" fill="currentColor" /><b>{history.total}</b></span></h1></header>{history.items.length ? <div className="question-history-cards">{history.items.map((item) => <Link key={item.id} href={`/space/questions/history/${item.id}`} className="question-history-card"><time dateTime={item.questionDay}>{displayDate(item.questionDay)}</time><h2>{item.prompt}</h2><span>Both answered <ChevronRight aria-hidden="true" /></span></Link>)}</div> : <div className="question-history-empty"><Heart aria-hidden="true" /><h2>Nothing to revisit yet.</h2><p>When you both answer a little question, it will be kept here.</p></div>}{history.totalPages > 1 ? <nav className="question-history-pagination" aria-label="Question history pages">{history.page > 1 ? <Link href={`/space/questions/history?page=${history.page - 1}`}><ChevronLeft aria-hidden="true" /> Newer</Link> : <span />}<p>Page {history.page} of {history.totalPages}</p>{history.page < history.totalPages ? <Link href={`/space/questions/history?page=${history.page + 1}`}>Older <ChevronRight aria-hidden="true" /></Link> : <span />}</nav> : null}</section>;
}

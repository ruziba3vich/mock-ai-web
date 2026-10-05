import { useState } from "react";
import { AttemptReview, examAPI, HistoryItem } from "./exams";
import { ArrowIcon, BookIcon, CheckIcon, HeadphonesIcon, HistoryIcon } from "./icons";

export default function ReviewPage({ history, loading, onOpenExams, onOpenPractice, onActivity }: { history: HistoryItem[]; loading: boolean; onOpenExams: () => void; onOpenPractice: () => void; onActivity?: () => void }) {
  const completed = history.filter((item) => item.status === "scored");
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [onlyMistakes, setOnlyMistakes] = useState(true);

  async function open(id: string) {
    setOpening(id); setError("");
    try {
      setReview(await examAPI.review(id));
      try {
        await examAPI.markReviewed(id);
        onActivity?.();
      } catch {
        // Reviewing answers remains available if activity tracking is temporarily unavailable.
      }
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This review could not be loaded."); }
    finally { setOpening(null); }
  }

  if (review) {
    const visible = onlyMistakes ? review.questions.filter((question) => !question.correct) : review.questions;
    const correct = review.questions.filter((question) => question.correct).length;
    return <div className="content page-content">
      <button className="back-link" onClick={() => setReview(null)}>← All attempts</button>
      <header className="review-summary"><div><p className="eyebrow">Answer review · {review.skill}</p><h1>{review.exam_title}</h1><p>{correct} of {review.questions.length} correct · Band {review.band_score.toFixed(1)}</p></div><div className="review-band"><strong>{review.band_score.toFixed(1)}</strong><span>Band</span></div></header>
      <div className="review-toolbar"><div><button className={!onlyMistakes ? "active" : ""} onClick={() => setOnlyMistakes(false)}>All questions</button><button className={onlyMistakes ? "active" : ""} onClick={() => setOnlyMistakes(true)}>Mistakes only</button></div><button onClick={onOpenPractice}>Practise this skill <ArrowIcon /></button></div>
      {visible.length ? <div className="review-questions">{visible.map((question, index) => <article className={`review-question ${question.correct ? "correct" : "incorrect"}`} key={question.id}><div className="review-number">{index + 1}</div><div><div className="review-question-top"><span>{question.section_title} · {labelType(question.type)}</span><strong>{question.correct ? <><CheckIcon /> Correct</> : "Needs review"}</strong></div><h2>{question.prompt}</h2><div className="answer-comparison"><div><span>Your answer</span><strong>{question.submitted_answers.length ? question.submitted_answers.join(" / ") : "Not answered"}</strong></div><div><span>Accepted answer</span><strong>{question.accepted_answers.join(" / ")}</strong></div></div><p className="review-explanation">{question.explanation || (question.correct ? "Your answer matches the accepted answer." : "Return to the source and identify the exact word or detail that supports the accepted answer.")}</p></div></article>)}</div> : <div className="all-correct"><CheckIcon /><h2>No mistakes in this attempt</h2><p>You answered every question correctly. Try focused practice or another timed mock to confirm the result.</p><button className="primary-action" onClick={onOpenPractice}>Open practice</button></div>}
    </div>;
  }

  return <div className="content page-content">
    <header className="page-header"><p className="eyebrow">Mistake notebook</p><h1>Review and learn</h1><p>Open any completed mock to compare your answers with the accepted answers. Start with mistakes, then practise the same skill again.</p></header>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="review-list loading"><i/><i/><i/></div> : completed.length ? <div className="review-list">{completed.map((item) => <button key={item.id} onClick={() => void open(item.id)} disabled={opening === item.id}><span className={`review-list-icon ${item.skill}`}>{item.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</span><span><strong>{item.title}</strong><small>{formatDate(item.started_at)} · {item.raw_score}/{item.question_count} correct</small></span><span className="review-list-score"><strong>{item.band_score?.toFixed(1)}</strong><small>Band</small></span><ArrowIcon /></button>)}</div> : <div className="progress-empty"><div className="empty-illustration"><HistoryIcon /></div><h2>Nothing to review yet</h2><p>Complete a mock exam first. Your answers and mistakes will appear here after scoring.</p><button className="primary-action" onClick={onOpenExams}>Take a mock exam <ArrowIcon /></button></div>}
  </div>;
}

function labelType(value: string) { return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }

import { useEffect, useState } from "react";
import { learningAPI, Mistake } from "./learning";
import { PracticeFeedback } from "./exams";
import { PracticeAnswer, SourceMaterial } from "./PracticePage";

export default function NotebookPage() {
  const [items, setItems] = useState<Mistake[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState("open"),
    [type, setType] = useState("");
  const [selected, setSelected] = useState<Mistake | null>(null),
    [answer, setAnswer] = useState<string[]>([]),
    [feedback, setFeedback] = useState<PracticeFeedback | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await learningAPI.mistakes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notebook");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function check() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await learningAPI.retry(selected.id, answer);
      setFeedback(result);
      setItems(
        items.map((q) =>
          q.id === selected.id ? { ...q, resolved: result.correct } : q,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (q) =>
      (filter === "all" ||
        (filter === "resolved" ? q.resolved : !q.resolved)) &&
      (!type || q.type === type),
  );
  return (
    <div className="content page-content">
      <header className="page-header">
        <p className="eyebrow">Learn from each attempt</p>
        <h1>Mistake notebook</h1>
        <p>
          Retry questions you missed in practice and completed mocks. A correct
          retry marks a mistake resolved; your original exam score stays the
          same.
        </p>
      </header>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button onClick={() => void load()}>Retry loading</button>
        </div>
      )}
      {selected ? (
        <>
          <button
            className="secondary-action"
            onClick={() => setSelected(null)}
          >
            ← Back to notebook
          </button>
          <div className="practice-workspace">
            <SourceMaterial question={selected} />
            <section className="practice-question">
              <h2>{selected.prompt}</h2>
              <PracticeAnswer
                question={selected}
                value={answer}
                disabled={!!feedback}
                onChange={setAnswer}
              />
              {feedback && (
                <div
                  className={`practice-feedback ${feedback.correct ? "correct" : "incorrect"}`}
                  role="status"
                >
                  <strong>
                    {feedback.correct
                      ? "Resolved — well done"
                      : "Keep practising"}
                  </strong>
                  <p>Accepted: {feedback.accepted_answers.join(" / ")}</p>
                  <p>{feedback.explanation}</p>
                </div>
              )}
              {!feedback ? (
                <button
                  className="primary-action"
                  disabled={busy || !answer.some((v) => v.trim())}
                  onClick={() => void check()}
                >
                  {busy ? "Checking…" : "Check retry"}
                </button>
              ) : (
                <button
                  className="primary-action"
                  onClick={() => {
                    setSelected(null);
                    setFeedback(null);
                  }}
                >
                  Continue notebook
                </button>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="filter-row">
            {["open", "resolved", "all"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f} (
                {
                  items.filter(
                    (q) =>
                      f === "all" ||
                      (f === "resolved" ? q.resolved : !q.resolved),
                  ).length
                }
                )
              </button>
            ))}
            <select
              aria-label="Question type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All question types</option>
              {[...new Set(items.map((q) => q.type))].map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p role="status">Loading your mistakes…</p>
          ) : visible.length ? (
            <div className="notebook-list">
              {visible.map((q) => (
                <button
                  key={q.id}
                  className="notebook-card"
                  onClick={() => {
                    setSelected(q);
                    setAnswer([]);
                    setFeedback(null);
                  }}
                >
                  <span className="eyebrow">
                    {q.skill} · {q.type.replaceAll("_", " ")}
                  </span>
                  <strong>{q.prompt}</strong>
                  <span>
                    {q.resolved
                      ? "✓ Resolved · retry again"
                      : "Retry this question →"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>
                {items.length
                  ? "All clear in this view"
                  : "Your notebook starts with practice"}
              </h2>
              <p>
                Missed answers appear here automatically. Keep practising and
                return to turn mistakes into progress.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

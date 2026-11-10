import type { Question } from "./exams";

const gap = /_{3,}/;

export const isGap = (question: Pick<Question, "prompt" | "options">) => !question.options.length && gap.test(question.prompt);

// The title, sub-heading and gap-free lines printed above a gap on a real IELTS notes sheet.
export function NoteLead({ question }: { question: Pick<Question, "config"> }) {
  const { title, heading, before } = (question.config || {}) as { title?: string; heading?: string; before?: string[] };
  return <>
    {title && <h3 className="note-title">{title}</h3>}
    {heading && <h4 className="note-heading">{heading}</h4>}
    {before?.map((line) => <p className="note-context" key={line}>{line}</p>)}
  </>;
}

// A notes line with its answer box in the sentence, where the gap is printed.
export function GapLine({ question, number, numbered, value, disabled, onChange, onBlur }: {
  question: Pick<Question, "prompt">; number: number; numbered?: boolean; value: string; disabled?: boolean; onChange: (value: string) => void; onBlur?: () => void;
}) {
  const [before, after] = question.prompt.split(gap);
  return <p className="note-line">{before}<span className="note-gap">{numbered && <b className="num">{number}</b>}<input className="gap-input" aria-label={`Answer to question ${number}`} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} /></span>{after}</p>;
}

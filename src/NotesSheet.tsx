import { Fragment, type ReactNode } from "react";
import type { Question } from "./exams";

const gap = /_{3,}/;

/** How a question is printed: `intro` above its group; on a gap, the sheet `title`, lines `before`/`after` it, `sub` for an indented point. */
type Layout = { title?: string; heading?: string; before?: string[]; after?: string[]; intro?: string[]; sub?: boolean; sheet?: "summary" | "table"; columns?: string[] };
const layout = (question: Pick<Question, "config">) => (question.config || {}) as Layout;

export const isGap = (question: Pick<Question, "prompt" | "options">) => !question.options.length && gap.test(question.prompt);

// One printed line: "# " starts a sub-heading, leading spaces indent a sub-point, **words** are bold.
function Line({ text, className = "note-context" }: { text: string; className?: string }) {
  const heading = text.startsWith("# ");
  const body = text.trim().slice(heading ? 2 : 0).split(/\*\*(.+?)\*\*/).map((part, i) => i % 2 ? <b key={i}>{part}</b> : part);
  return heading ? <h4 className="note-heading">{body}</h4> : <p className={`${className}${/^\s/.test(text) ? " sub" : ""}`}>{body}</p>;
}
const lines = (list?: string[], className?: string) => list?.map((text, i) => <Line key={i} text={text} className={className} />);

// The instructions printed above a group of questions ("Questions 11 and 12 · Choose TWO letters").
export function GroupIntro({ question }: { question: Pick<Question, "config"> }) {
  const { intro } = layout(question);
  return intro?.length ? <div className="group-intro">{lines(intro, "group-line")}</div> : null;
}

// The title, sub-heading and gap-free lines printed above a gap on a real IELTS notes sheet.
export function NoteLead({ question }: { question: Pick<Question, "config"> }) {
  const { title, heading, before } = layout(question);
  return <>
    {title && <h3 className="note-title">{title}</h3>}
    {heading && <h4 className="note-heading">{heading}</h4>}
    {lines(before)}
  </>;
}

type GapProps = { number: number; numbered?: boolean; value: string; disabled?: boolean; onChange: (value: string) => void; onBlur?: () => void };

// The words around a gap, with the answer box where the gap is printed.
function Gap({ text, number, numbered, value, disabled, onChange, onBlur }: GapProps & { text: string }) {
  const [before, after] = text.split(gap);
  return <>{before}<span className="note-gap">{numbered && <b className="num">{number}</b>}<input className="gap-input" aria-label={`Answer to question ${number}`} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} /></span>{after}</>;
}

// A notes line with its answer box in the sentence, where the gap is printed.
export function GapLine({ question, ...rest }: GapProps & { question: Pick<Question, "prompt"> }) {
  return <p className="note-line"><Gap text={question.prompt} {...rest} /></p>;
}

/** Questions as they are laid out: consecutive gaps of one sheet stay together, every other question stands alone. */
export function blocks(questions: Question[]) {
  const out: Question[][] = [];
  for (const question of questions) {
    const { title, intro, sheet } = layout(question), last = out[out.length - 1];
    if (last && isSheet(last) && isGap(question) && !title && !intro && !sheet) last.push(question); else out.push([question]);
  }
  return out;
}
export const isSheet = (block: Question[]) => isGap(block[0]) && !!(layout(block[0]).title || layout(block[0]).sheet);

/** One completion task printed as a single sheet: notes with bullets, a summary paragraph, or a table. */
export function Sheet({ questions, first, current, values, onFocus, onChange, onBlur }: {
  questions: Question[]; /** Index of the first question in the whole paper. */ first: number; current: number; values: Record<string, string[]>;
  onFocus: (index: number) => void; onChange: (question: Question, value: string) => void; onBlur: (question: Question) => void;
}) {
  const head = layout(questions[0]);
  const row = (question: Question, i: number, className: string) => ({ id: `question-${question.id}`, "data-index": first + i, tabIndex: -1, onFocus: () => onFocus(first + i), className: `note-row ${className}${first + i === current ? " is-current" : ""}` });
  const input = (question: Question, i: number, text = question.prompt) => <Gap text={text} number={first + i + 1} numbered value={values[question.id]?.[0] || ""} onChange={(value) => onChange(question, value)} onBlur={() => onBlur(question)} />;
  const cells = (text: string, fill?: (cell: string) => ReactNode) => text.split(" | ").map((cell, i) => <td key={i}>{fill && gap.test(cell) ? fill(cell) : cell}</td>);
  return <div className="note-sheet">
    {head.title && <h3 className="note-title">{head.title}</h3>}
    {head.sheet === "table" ? <div className="note-table"><table>
      {head.columns && <thead><tr>{head.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>}
      <tbody>{questions.map((question, i) => <Fragment key={question.id}>
        <tr {...row(question, i, "")}>{cells(question.prompt, (cell) => input(question, i, cell))}</tr>
        {layout(question).after?.map((text) => <tr key={text}>{cells(text)}</tr>)}
      </Fragment>)}</tbody>
    </table></div>
      : head.sheet === "summary" ? <p className="note-line">{questions.map((question, i) => <span key={question.id} {...row(question, i, "")}>{input(question, i)} </span>)}</p>
      : questions.map((question, i) => { const { heading, before, after, sub } = layout(question); return <Fragment key={question.id}>
        {heading && <h4 className="note-heading">{heading}</h4>}
        {lines(before)}
        <p {...row(question, i, `note-line${sub ? " sub" : ""}`)}>{input(question, i)}</p>
        {lines(after)}
      </Fragment>; })}
  </div>;
}

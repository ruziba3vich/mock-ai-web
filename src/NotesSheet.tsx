import { Fragment, useState, type ReactNode } from "react";
import type { Question } from "./exams";

const gap = /_{3,}/;

/** How a question is printed: `intro` above its group; on a gap, the sheet `title`, lines `before`/`after` it, `sub` for an indented point. */
type Layout = { title?: string; heading?: string; before?: string[]; after?: string[]; intro?: string[]; sub?: boolean; sheet?: "summary" | "table" | "match"; columns?: string[]; select?: boolean };
const layout = (question: Pick<Question, "config">) => (question.config || {}) as Layout;
/** The options go in one dropdown beside the statement ("which paragraph, A–G") instead of a list of radio buttons. */
export const isSelect = (question: Pick<Question, "config" | "options">) => !!layout(question).select && question.options.length > 0;

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
    if (last && isSheet(last) && fits(last[0], question) && !title && !intro && !sheet) last.push(question); else out.push([question]);
  }
  return out;
}
const isMatch = (question: Question) => layout(question).sheet === "match" && question.options.length > 0;
// A matching sheet takes the questions that share its box of options; any other sheet takes gaps.
const fits = (head: Question, question: Question) => isMatch(head) ? question.options.length > 0 : isGap(question);
export const isSheet = (block: Question[]) => isMatch(block[0]) || isGap(block[0]) && !!(layout(block[0]).title || layout(block[0]).sheet);

/** One completion task printed as a single sheet: notes with bullets, a summary paragraph, or a table. */
export function Sheet({ questions, first, current, values, onFocus, onChange, onBlur, onPick }: {
  questions: Question[]; /** Index of the first question in the whole paper. */ first: number; current: number; values: Record<string, string[]>;
  onFocus: (index: number) => void; onChange: (question: Question, value: string) => void; onBlur: (question: Question) => void;
  /** An option was put in a matching box; or taken back out (no value); saved at once. */ onPick: (question: Question, value?: string) => void;
}) {
  const head = layout(questions[0]);
  // The option picked up by a click or tap, waiting for a box.
  const [held, setHeld] = useState<string>();
  const row = (question: Question, i: number, className: string) => ({ id: `question-${question.id}`, "data-index": first + i, tabIndex: -1, onFocus: () => onFocus(first + i), className: `note-row ${className}${first + i === current ? " is-current" : ""}` });
  if (isMatch(questions[0])) {
    const options = questions[0].options, used = new Set(questions.map((question) => values[question.id]?.[0]));
    const put = (question: Question, value?: string) => { if (value && options.some((option) => option.value === value)) onPick(question, value); setHeld(undefined); };
    return <div className="match">
      <div className="match-rows">
        {head.columns?.[0] && <h4 className="note-heading">{head.columns[0]}</h4>}
        {questions.map((question, i) => { const number = first + i + 1, option = options.find((o) => o.value === values[question.id]?.[0]); return <div key={question.id} {...row(question, i, "match-row")}>
          <span className="match-item"><b className="num">{number}</b>{question.prompt}</span>
          <span className={`match-slot${option ? " filled" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); put(question, event.dataTransfer.getData("text/plain")); }}>
            <button type="button" className="match-drop" aria-label={`Answer to question ${number}${option ? `: ${option.label} ${option.value}` : ", empty"}`} onClick={() => put(question, held)}>{option ? <><b className="num">{option.label}</b>{option.value}</> : number}</button>
            {option && <button type="button" className="match-clear" aria-label={`Remove answer to question ${number}`} onClick={() => onPick(question)}>✕</button>}          </span>
        </div>; })}
      </div>
      <div className="match-options">
        {head.columns?.[1] && <h4 className="note-heading">{head.columns[1]}</h4>}
        {options.map((option) => <button type="button" key={option.id} draggable aria-pressed={held === option.value} className={`match-chip${used.has(option.value) ? " used" : ""}`} onDragStart={(event) => event.dataTransfer.setData("text/plain", option.value)} onClick={() => setHeld(held === option.value ? undefined : option.value)}><b className="num">{option.label}</b>{option.value}</button>)}
      </div>
      <p className="match-hint">Drag an answer into a box, or tap it and then tap the box. Press ✕ to take it out again.</p>
    </div>;
  }
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

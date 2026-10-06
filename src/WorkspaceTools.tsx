import { useEffect, useRef, useState } from "react";
import { learningAPI, Workspace } from "./learning";
export function useWorkspace(id: string) {
  const [data, setData] = useState<Workspace>({
      flags: [],
      notes: {},
      highlights: {},
    }),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Loading notes…");
  const current = useRef(data),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    learningAPI
      .workspace(id)
      .then((w) => {
        if (active) {
          const v = {
            flags: w.flags || [],
            notes: w.notes || {},
            highlights: w.highlights || {},
          };
          current.current = v;
          setData(v);
          setReady(true);
          setStatus("Notes synced");
        }
      })
      .catch(() => {
        if (active) setStatus("Notes unavailable. Reopen the exam to retry.");
      });
    return () => {
      active = false;
    };
  }, [id]);
  function update(fn: (w: Workspace) => Workspace) {
    if (!ready) return;
    const next = fn(current.current);
    current.current = next;
    setData(next);
    setStatus("Saving notes…");
    queue.current = queue.current
      .then(() => learningAPI.saveWorkspace(id, next))
      .then(() => setStatus("Notes synced"))
      .catch(() =>
        setStatus(
          "Notes could not be saved. Check your connection and try saving again.",
        ),
      );
  }
  return { data, ready, status, update };
}
export function AnnotatedPassage({
  text,
  highlights,
  onHighlight,
  disabled,
}: {
  text: string;
  highlights: string[];
  onHighlight: (values: string[]) => void;
  disabled: boolean;
}) {
  const root = useRef<HTMLElement>(null),
    [selection, setSelection] = useState("");
  function select() {
    const range = window.getSelection();
    if (
      range &&
      root.current?.contains(range.anchorNode) &&
      root.current?.contains(range.focusNode)
    ) {
      const value = range.toString().trim();
      setSelection(value.length <= 1000 ? value : "");
    } else setSelection("");
  }
  const escaped = highlights
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = escaped.length
    ? text.split(new RegExp(`(${escaped.join("|")})`, "g"))
    : [text];
  return (
    <>
      <div className="passage-tools">
        <span>Select text to highlight</span>
        <button
          disabled={disabled || !selection}
          onClick={() => {
            onHighlight([...new Set([...highlights, selection])].slice(-30));
            setSelection("");
          }}
        >
          Highlight selection
        </button>
        <button
          disabled={disabled || !highlights.length}
          onClick={() => onHighlight([])}
        >
          Clear highlights
        </button>
      </div>
      <article ref={root} onMouseUp={select} onTouchEnd={select}>
        {parts.map((part, i) =>
          highlights.includes(part) ? <mark key={i}>{part}</mark> : part,
        )}
      </article>
    </>
  );
}

import { type RefObject, useEffect, useRef, useState } from "react";
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

// A saved highlight is `${offset}${SEP}${text}`: the text, and how far into the zone it was selected.
// Highlights saved before this hold the text only, and mark every copy of it.
const SEP = "\u0001";

/** Where each saved highlight sits in the zone now. */
function locate(root: HTMLElement, values: string[]) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const full = nodes.map((node) => node.data).join("");
  const point = (offset: number, end: boolean): [Text, number] => {
    for (const node of nodes) {
      if (offset < node.length || (end && offset === node.length)) return [node, offset];
      offset -= node.length;
    }
    return [nodes[nodes.length - 1], nodes[nodes.length - 1].length];
  };
  return values.flatMap((value) => {
    const cut = value.indexOf(SEP), text = value.slice(cut + 1), wanted = Number(value.slice(0, Math.max(cut, 0)));
    let starts: number[] = [];
    for (let i = text ? full.indexOf(text) : -1; i >= 0; i = full.indexOf(text, i + 1)) starts.push(i);
    // The text before a highlight changes as answers and flags do, so take the copy nearest to where it was made.
    if (cut >= 0 && starts.length) starts = [starts.reduce((a, b) => (Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a))];
    return starts.map((start) => {
      const range = document.createRange();
      range.setStart(...point(start, false));
      range.setEnd(...point(start + text.length, true));
      return { value, range };
    });
  });
}

/**
 * Selected text inside the zone is highlighted at once; selecting inside a highlight removes it.
 * shortcut: drawn with the CSS Custom Highlight API, so browsers without it (iOS before 17.2, Firefox before 140) show none; upgrade to wrapped <mark>s if those students need it.
 */
export function useHighlighter(root: RefObject<HTMLElement | null>, values: string[], onChange: (values: string[]) => void, disabled = false) {
  const live = useRef({ values, onChange, disabled });
  live.current = { values, onChange, disabled };
  const painted = typeof CSS !== "undefined" && "highlights" in CSS;
  // After every render: the text under the highlights is redrawn with the page.
  useEffect(() => {
    if (!painted) return;
    if (root.current && values.length) CSS.highlights.set("exam", new Highlight(...locate(root.current, values).map((v) => v.range)));
    else CSS.highlights.delete("exam");
  });
  useEffect(() => {
    let timer = 0, pressed = false;
    const inside = (node: Node) => !!root.current?.contains(node) && !(node instanceof Element ? node : node.parentElement)?.closest("button, input, textarea, select");
    const capture = () => {
      const { values, onChange, disabled } = live.current, selection = window.getSelection();
      if (disabled || !root.current || !selection?.rangeCount || selection.isCollapsed) return;
      const range = selection.getRangeAt(0), text = range.toString();
      if (!text.trim() || text.length > 500 || !inside(range.startContainer) || !inside(range.endContainer)) return;
      const holding = locate(root.current, values).filter((v) => v.range.compareBoundaryPoints(Range.START_TO_START, range) <= 0 && v.range.compareBoundaryPoints(Range.END_TO_END, range) >= 0).map((v) => v.value);
      const before = document.createRange();
      before.selectNodeContents(root.current);
      before.setEnd(range.startContainer, range.startOffset);
      onChange(holding.length ? values.filter((v) => !holding.includes(v)) : [...values, `${before.toString().length}${SEP}${text}`].slice(-60));
      selection.removeAllRanges();
    };
    const down = () => { pressed = true; };
    const up = () => { pressed = false; capture(); };
    // A finger or the keyboard gives no mouseup, so a selection left alone for a moment counts as made.
    const changed = () => { window.clearTimeout(timer); if (!pressed) timer = window.setTimeout(capture, 700); };
    document.addEventListener("mousedown", down);
    document.addEventListener("mouseup", up);
    document.addEventListener("selectionchange", changed);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("selectionchange", changed);
      if (painted) CSS.highlights.delete("exam");
    };
  }, []);
}

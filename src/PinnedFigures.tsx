import { useRef, useState } from "react";
import { ArrowIcon, CloseIcon } from "./icons";

type Props = { urls: string[]; /** What the figures belong to, e.g. the passage title. */ title: string; /** Called when the image turns out to be a portrait page scan, which is unreadable in a pinned slot. */ onPortrait?: () => void };

/** The images of one passage or task, pinned above its text: one figure at a time, so they never cover the text. */
export default function PinnedFigures({ urls, title, onPortrait }: Props) {
  const [at, setAt] = useState(0);
  const [hidden, setHidden] = useState(false);
  const zoom = useRef<HTMLDialogElement>(null);
  const i = Math.min(at, urls.length - 1);
  const alt = `${title}, figure ${i + 1}`;
  const enlarge = () => zoom.current?.showModal();
  return <figure className={`pinned-figures${hidden ? " is-hidden" : ""}`}>
    <figcaption>
      <span className="num">{urls.length > 1 ? `Figure ${i + 1} of ${urls.length}` : "Figure"}</span>
      {urls.length > 1 && <>
        <button type="button" className="pf-step pf-prev" aria-label="Previous figure" disabled={i === 0} onClick={() => setAt(i - 1)}><ArrowIcon /></button>
        <button type="button" className="pf-step" aria-label="Next figure" disabled={i === urls.length - 1} onClick={() => setAt(i + 1)}><ArrowIcon /></button>
      </>}
      {!hidden && <button type="button" className="pf-text" onClick={enlarge}>Enlarge</button>}
      <button type="button" className="pf-text" aria-expanded={!hidden} onClick={() => setHidden(!hidden)}>{hidden ? "Show figure" : "Hide figure"}</button>
    </figcaption>
    {/* shortcut: a portrait image is taken to be a page scan, upgrade to a flag on the section when content carries one */}
    {!hidden && <img key={urls[i]} src={urls[i]} alt={alt} onClick={enlarge} onLoad={e => e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.2 && onPortrait?.()} />}
    <dialog className="pf-zoom" ref={zoom} aria-label={alt} onClick={e => e.target === e.currentTarget && e.currentTarget.close()}>
      <button type="button" className="pf-step" aria-label="Close figure" onClick={() => zoom.current?.close()}><CloseIcon /></button>
      <img src={urls[i]} alt={alt} />
    </dialog>
  </figure>;
}

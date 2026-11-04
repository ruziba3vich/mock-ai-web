import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * The shell every admin screen is built from.
 *
 * Each tab used to invent its own shape, and most of them opened on a create
 * form: the operator landed on "Exams" and was looking at an empty exam rather
 * than the exams they have. These primitives make one answer for all of them --
 * a searchable, filterable list of what exists, a Create button in the top
 * right, and a sheet that opens over the list for the detail of one item.
 *
 * Nothing here talks to the API. A screen owns its data; this owns its shape.
 */

/** What the signed-in administrator is, and what the server lets them reach. */
export type AdminIdentity = {
  id: string; email: string; display_name: string;
  centre_id?: string; centre_name?: string;
  role?: "platform" | "centre";
  permissions?: string[];
};

/**
 * Permissions reach the screens, not only the tab strip.
 *
 * A visible tab says someone may read that section. It does not say they may
 * create or change anything inside it, so every screen asks `can` before it
 * offers a Create button or an editor. The API still checks for itself; this
 * only keeps the panel from offering work that would be refused.
 *
 * The default permits, because each screen is also mounted on its own -- in
 * tests, and anywhere outside the panel shell -- where there is no identity to
 * ask. Hiding everything in that case would be a blank screen, not safety.
 */
const AdminScope = createContext<{ admin: AdminIdentity | null; can: (key: string) => boolean }>({
  admin: null,
  can: () => true,
});
export const AdminProvider = AdminScope.Provider;
export const useAdminScope = () => useContext(AdminScope);

/** A page title, its one-line purpose, and the action that belongs top right. */
export function AdminHeading({ title, description, action }: {
  title: string; description?: string; action?: ReactNode;
}) {
  return <header className="admin-page-heading admin-heading-row">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action ? <div className="admin-heading-action">{action}</div> : null}
  </header>;
}

/** The search box every list opens with, plus whatever filters it needs. */
export function AdminFilters({ label, value, onChange, placeholder, children, count }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; children?: ReactNode; count?: string;
}) {
  return <div className="admin-filters">
    <label>{label}<input type="search" aria-label={label} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} /></label>
    {children}
    {count ? <p className="admin-filter-count">{count}</p> : null}
  </div>;
}

/** One dropdown filter. Its label is its accessible name, so tests can reach it. */
export function AdminFilter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return <label>{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}

export type AdminColumn = { key: string; label: string; width?: string };
export type AdminRow = {
  id: string;
  /** The accessible name of the row, which is how it is opened. */
  openLabel: string;
  open: () => void;
  selected?: boolean;
  cells: ReactNode[];
};

/**
 * The list itself: a header row, one button per item, and paging.
 *
 * Rows are buttons rather than table cells because opening the row is the
 * whole point of the screen, and a row that only looks clickable is worse than
 * one that announces itself.
 */
export function AdminTable({ columns, rows, noun, empty, label, pageSize: initialPageSize = 10, action }: {
  columns: AdminColumn[]; rows: AdminRow[]; noun: string; empty: ReactNode; label: string;
  pageSize?: number;
  /** Column of per-row actions; its header is blank. */
  action?: string;
}) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  useEffect(() => { setPage(1); }, [rows.length, pageSize]);
  const template = [...columns.map(c => c.width || "minmax(0,1fr)"), action ? "120px" : "110px"].join(" ");
  return <>
    <div className="admin-table" aria-label={label}>
      <div className="admin-table-head" style={{ gridTemplateColumns: template }}>
        {columns.map(column => <span key={column.key}>{column.label}</span>)}<span />
      </div>
      {visible.map(row => <button type="button" key={row.id} aria-label={row.openLabel} onClick={row.open}
        className={row.selected ? "admin-table-row selected" : "admin-table-row"} style={{ gridTemplateColumns: template }}>
        {row.cells.map((cell, i) => <span key={i}>{cell}</span>)}
        <span className="admin-table-open">{action || "Open"} →</span>
      </button>)}
      {rows.length === 0 && <div className="admin-table-empty">{empty}</div>}
    </div>
    {rows.length > 0 && <nav className="admin-table-pagination" aria-label={`${label} pagination`}>
      <p>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} of {rows.length} {noun}</p>
      <div>
        <label>Rows<select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
          {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
        <button className="secondary-action" disabled={current === 1} onClick={() => setPage(v => Math.max(1, v - 1))}>Previous</button>
        <span>Page {current} of {pageCount}</span>
        <button className="secondary-action" disabled={current === pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}>Next</button>
      </div>
    </nav>}
  </>;
}

/**
 * The detail of one item, over the list rather than beside it.
 *
 * Editors here are long -- an exam carries every question it asks -- so this is
 * a full sheet rather than a small dialog, and it scrolls on its own so the
 * actions in its footer stay reachable.
 */
export function AdminSheet({ title, subtitle, onClose, children, footer, wide }: {
  title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode;
  footer?: ReactNode; wide?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  // Held in a ref so a new closure from the parent's next render cannot
  // re-run the effect and pull focus back out of whatever is being typed in.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, []);
  return <div className="admin-sheet-backdrop"
    onMouseDown={event => { if (event.target === event.currentTarget) close.current(); }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      className={wide ? "admin-sheet wide" : "admin-sheet"}>
      <header className="admin-sheet-head">
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        <button type="button" className="admin-sheet-close" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <div className="admin-sheet-body">{children}</div>
      {footer ? <footer className="admin-sheet-foot">{footer}</footer> : null}
    </section>
  </div>;
}

/** A draft/published/archived pill, coloured by the existing status chips. */
export function StatusChip({ status, children }: { status: string; children?: ReactNode }) {
  return <span className={`status-chip status-${status}`}>{children || status}</span>;
}

/** Case-insensitive substring match over whichever fields a screen names. */
export function useSearch<T>(items: T[], query: string, fields: (item: T) => (string | null | undefined)[]) {
  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => fields(item).some(value => value?.toLowerCase().includes(needle)));
    // `fields` is written inline at every call site, so it is deliberately not
    // a dependency: the query and the items are what change.
  }, [items, query]);
}

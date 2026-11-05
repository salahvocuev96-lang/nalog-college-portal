"use client";
// Таблица с сортировкой. На телефоне строки превращаются в карточки.
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Empty, cx } from "./ui";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number | null;
  className?: string;
  /** Главная колонка: на телефоне становится заголовком карточки */
  primary?: boolean;
}

export function DataTable<T>({ rows, columns, rowKey, empty = "Ничего не найдено", pageSize = 50, onRowClick }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; empty?: string; pageSize?: number; onRowClick?: (r: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a);
      const y = col.sort!(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ru")) * sort.dir;
    });
  }, [rows, columns, sort]);
  const shown = sorted.slice(0, limit);
  if (!rows.length) return <Empty icon="search" title={empty} />;
  const primary = columns.find((c) => c.primary) ?? columns[0];

  return (
    <>
      <div className="hidden md:block scroll-x">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-gradient-to-b from-brand-50/80 to-brand-50/30 text-left text-[11px] uppercase tracking-wider text-brand-800/70">
              {columns.map((c) => (
                <th key={c.key} className={cx("px-4 py-3 font-semibold first:pl-5", c.className)}>
                  {c.sort ? (
                    <button onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))} className="inline-flex items-center gap-1 uppercase hover:text-brand-800" aria-label={`Сортировать: ${c.label}`}>
                      {c.label}
                      <Icon name={sort?.key === c.key && sort.dir === -1 ? "chevronLeft" : "chevronRight"} className={cx("size-3 rotate-90 transition", sort?.key !== c.key && "opacity-30")} />
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))} className={cx("transition-colors duration-150 odd:bg-white even:bg-page/40 hover:bg-gold-50/50", onRowClick && "cursor-pointer")}>
                {columns.map((c) => <td key={c.key} className={cx("px-4 py-3 first:pl-5", c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 p-3 md:hidden">
        {shown.map((r) => (
          <li key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))} className={cx("rounded-2xl border border-line/80 bg-white px-4 py-3.5 shadow-sm transition", onRowClick && "active:scale-[0.99] active:bg-page")}>
            <div className="text-sm font-semibold text-brand-900">{primary.render(r)}</div>
            <dl className="mt-2 grid border-t border-line/60 pt-2 grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {columns.filter((c) => c !== primary).map((c) => (
                c.label
                  ? <div key={c.key} className="min-w-0"><dt className="text-muted">{c.label}</dt><dd className="truncate text-ink">{c.render(r)}</dd></div>
                  : <div key={c.key} className="col-span-2 mt-1">{c.render(r)}</div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <button onClick={() => setLimit((l) => l + pageSize)} className="w-full border-t border-line py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
          Показать ещё ({sorted.length - limit})
        </button>
      )}
    </>
  );
}

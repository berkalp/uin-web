"use client";

import {
  Children,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export default function TimelinePagedRow({
  children,
  pageSize = 4,
  ariaLabel,
}: {
  children: ReactNode;
  pageSize?: number;
  ariaLabel: string;
}) {
  const items = Children.toArray(children);

  const [page, setPage] = useState(1);

  const pageCount = Math.max(
    1,
    Math.ceil(items.length / pageSize)
  );

  const safePage = Math.min(
    page,
    pageCount
  );

  const visibleItems = items.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems}
      </div>

      {pageCount > 1 && (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          aria-label={ariaLabel}
        >
          <button
            type="button"
            aria-label="Önceki sayfa"
            disabled={safePage === 1}
            onClick={() =>
              setPage((value) =>
                Math.max(1, value - 1)
              )
            }
            className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ←
          </button>

          {Array.from(
            { length: pageCount },
            (_, index) => index + 1
          ).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() =>
                setPage(pageNumber)
              }
              aria-current={
                safePage === pageNumber
                  ? "page"
                  : undefined
              }
              className={
                safePage === pageNumber
                  ? "flex h-10 min-w-10 items-center justify-center rounded-xl bg-gray-950 px-3 text-sm font-black text-white"
                  : "flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50"
              }
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            aria-label="Sonraki sayfa"
            disabled={
              safePage === pageCount
            }
            onClick={() =>
              setPage((value) =>
                Math.min(
                  pageCount,
                  value + 1
                )
              )
            }
            className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            →
          </button>
        </nav>
      )}
    </>
  );
}
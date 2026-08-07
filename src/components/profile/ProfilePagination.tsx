"use client";

type ProfilePaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
};

function pageWindow(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const result = new Set<number>([
    0,
    pageCount - 1,
    page - 1,
    page,
    page + 1,
  ]);

  return Array.from(result)
    .filter((value) => value >= 0 && value < pageCount)
    .sort((left, right) => left - right);
}

export default function ProfilePagination({
  page,
  pageCount,
  onPageChange,
  label = "Profile section pages",
}: ProfilePaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pages = pageWindow(page, pageCount);

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-center gap-2"
      aria-label={label}
    >
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        ←
      </button>

      {pages.map((pageIndex, index) => {
        const previous = pages[index - 1];
        const needsGap =
          previous !== undefined && pageIndex - previous > 1;

        return (
          <span key={pageIndex} className="contents">
            {needsGap && (
              <span className="px-1 text-xs font-bold text-gray-400">
                …
              </span>
            )}
            <button
              type="button"
              aria-current={page === pageIndex ? "page" : undefined}
              onClick={() => onPageChange(pageIndex)}
              className={`min-w-9 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                page === pageIndex
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {pageIndex + 1}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        →
      </button>
    </nav>
  );
}

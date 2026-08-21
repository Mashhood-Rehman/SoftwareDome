import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/lib/fa-icons";

export default function CategoriesPagination({
  page,
  totalPages,
  hrefForPage,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string | null;
  onPageChange?: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= window) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  const arrowClass =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50";
  const disabledArrowClass =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-300 opacity-40";

  function renderArrow(target: number, disabled: boolean, ariaLabel: string, icon: React.ReactNode) {
    if (disabled) {
      return (
        <span className={disabledArrowClass} aria-hidden>
          {icon}
        </span>
      );
    }
    const href = hrefForPage(target);
    if (href) {
      return (
        <Link href={href} className={arrowClass} aria-label={ariaLabel}>
          {icon}
        </Link>
      );
    }
    return (
      <button onClick={() => onPageChange?.(target)} className={arrowClass} aria-label={ariaLabel}>
        {icon}
      </button>
    );
  }

  function renderPageNumber(p: number) {
    const className = `flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
      p === page ? "bg-primary-navy text-white" : "text-zinc-600 hover:bg-zinc-50"
    }`;
    const href = hrefForPage(p);
    if (href) {
      return (
        <Link key={p} href={href} className={className} aria-current={p === page ? "page" : undefined}>
          {p}
        </Link>
      );
    }
    return (
      <button
        key={p}
        onClick={() => onPageChange?.(p)}
        className={className}
        aria-current={p === page ? "page" : undefined}
      >
        {p}
      </button>
    );
  }

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {renderArrow(page - 1, page <= 1, "Previous page", <ChevronLeft size={15} />)}

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-zinc-400">
            …
          </span>
        ) : (
          renderPageNumber(p)
        )
      )}

      {renderArrow(page + 1, page >= totalPages, "Next page", <ChevronRight size={15} />)}
    </nav>
  );
}

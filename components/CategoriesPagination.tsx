import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/lib/fa-icons";

export default function CategoriesPagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
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

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-300 opacity-40"
          aria-hidden
        >
          <ChevronLeft size={15} />
        </span>
      )}

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-zinc-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefForPage(p)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
              p === page ? "bg-primary-navy text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link
          href={hrefForPage(page + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-300 opacity-40"
          aria-hidden
        >
          <ChevronRight size={15} />
        </span>
      )}
    </nav>
  );
}

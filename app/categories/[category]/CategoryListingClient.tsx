"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CategoriesPagination from "@/components/CategoriesPagination";
import StarRating from "@/components/StarRating";
import { Box, ArrowDownUp, MessageSquare, ArrowUpRight } from "@/lib/fa-icons";
import { getSoftwaresByCategory } from "@/app/categories/actions";

const PAGE_SIZE = 12;

const sortOptions = [
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A-Z)" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

type SoftwareItem = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  introduction: string | null;
  rating: number | null;
  createdAt: string;
};

type ListingData = { softwares: SoftwareItem[]; total: number; totalPages: number };

export default function CategoryListingClient({
  categorySlug,
  page,
  staticPageLimit,
  initialData,
}: {
  categorySlug: string;
  page: number;
  staticPageLimit: number;
  initialData: ListingData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = (searchParams.get("sort") as SortValue) || "rating";
  const q = searchParams.get("q") || "";
  const requestedPage = parseInt(searchParams.get("page") || "", 10) || page;

  const [loadedKey, setLoadedKey] = useState(`${page}:`);
  const [currentPage, setCurrentPage] = useState(page);
  const [data, setData] = useState<ListingData>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = `${requestedPage}:${q}`;
    if (key === loadedKey) return;
    let cancelled = false;
    setLoading(true);
    getSoftwaresByCategory(categorySlug, { page: requestedPage, pageSize: PAGE_SIZE, q: q || undefined }).then(
      (res) => {
        if (cancelled) return;
        if (res.success && res.data) setData(res.data as ListingData);
        setCurrentPage(requestedPage);
        setLoadedKey(key);
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [categorySlug, requestedPage, q, loadedKey]);

  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";

  const handleSortChange = (newSort: SortValue) => {
    router.replace(`/categories/${categorySlug}?sort=${newSort}${qSuffix}`, { scroll: false });
  };

  const handlePageChange = (targetPage: number) => {
    router.replace(`/categories/${categorySlug}?sort=${sort}&page=${targetPage}${qSuffix}`, { scroll: false });
  };

  const hrefForPage = (targetPage: number): string | null => {
    if (q === "" && sort === "rating" && targetPage <= staticPageLimit) {
      return targetPage <= 1 ? `/categories/${categorySlug}` : `/categories/${categorySlug}/page/${targetPage}`;
    }
    return null;
  };

  const sortedSoftwares = q
    ? data.softwares
    : [...data.softwares].sort((a, b) => {
        if (sort === "name") return (a.name || "").localeCompare(b.name || "");
        if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return (b.rating || 0) - (a.rating || 0);
      });

  return (
    <>
      {q && (
        <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
          Showing results for <span className="text-primary-navy">&ldquo;{q}&rdquo;</span>
          <Link href={`/categories/${categorySlug}`} className="text-brand-green-dark hover:underline">
            Clear search
          </Link>
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-bold text-zinc-500">
          <ArrowDownUp size={13} className="text-brand-green-dark" />
          Sort
        </span>
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSortChange(opt.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              sort === opt.value
                ? "bg-brand-green/10 text-brand-green-dark"
                : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-zinc-100 bg-zinc-50" />
          ))}
        </div>
      ) : sortedSoftwares.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <Box size={28} className="mb-3 text-zinc-300" />
          <h3 className="mb-1 text-base font-bold text-primary-navy">No softwares found</h3>
          <p className="max-w-sm text-xs text-zinc-500">
            We couldn't find any listings for this category. Browse other categories instead.
          </p>
          <Link
            href="/categories"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-green-light px-6 py-2.5 text-sm font-bold text-primary-navy shadow-sm transition-all hover:bg-brand-green hover:text-white"
          >
            Browse categories
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {sortedSoftwares.map((software, idx) => (
              <div
                key={software.id}
                className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-brand-green/40 hover:shadow-lg sm:flex-row sm:items-center"
              >
                <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-400 sm:flex">
                  {(currentPage - 1) * PAGE_SIZE + idx + 1}
                </span>

                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                  {software.logo ? (
                    <img src={software.logo} alt={software.name} className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-xl font-black text-primary-navy/25">{software.name?.charAt(0)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-primary-navy transition-colors group-hover:text-brand-green-dark">
                      {software.name}
                    </h3>
                    <StarRating rating={software.rating || 0} />
                    <span className="text-xs font-bold text-zinc-400">{(software.rating || 0).toFixed(1)}</span>
                  </div>
                  {software.introduction && (
                    <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-zinc-500">{software.introduction}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/softwares/${software.slug}#reviews`}
                    className="hidden items-center gap-1.5 rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-500 transition-colors hover:border-primary-navy hover:text-primary-navy sm:flex"
                  >
                    <MessageSquare size={13} />
                    Reviews
                  </Link>
                  <Link
                    href={`/softwares/${software.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-navy px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-green-dark"
                  >
                    View Profile
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <CategoriesPagination
            page={currentPage}
            totalPages={data.totalPages}
            hrefForPage={hrefForPage}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </>
  );
}

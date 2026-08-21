import Link from "next/link";
import { cache } from "react";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import SiteHeader from "@/components/SiteHeader";
import CategoriesPagination from "@/components/CategoriesPagination";
import StarRating from "@/components/StarRating";
import { ArrowLeft, Box, Filter, ArrowDownUp, MessageSquare, ArrowUpRight } from "@/lib/fa-icons";
import { getSoftwaresByCategory, getCategoryWithSubcategories } from "@/app/categories/actions";
import { PAGE_SIZE } from "@/app/categories/constants";

const sortOptions = [
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A-Z)" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

export const loadCategoryPage = cache(async (categorySlug: string, page: number, q: string) => {
  const [listingRes, detailRes] = await Promise.all([
    getSoftwaresByCategory(categorySlug, { page, pageSize: PAGE_SIZE, q: q || undefined }),
    getCategoryWithSubcategories(categorySlug),
  ]);
  return {
    listing: listingRes.success ? (listingRes.data as any) : null,
    detail: detailRes.success ? (detailRes.data as any) : null,
  };
});

function hrefForPage(categorySlug: string, sort: string, q: string, targetPage: number): string {
  const params = new URLSearchParams();
  if (sort !== "rating") params.set("sort", sort);
  if (q) params.set("q", q);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const base = `/categories/${categorySlug}`;
  if (targetPage <= 1) return `${base}${suffix}`;
  return `${base}/page/${targetPage}${suffix}`;
}

export default async function CategoryPageContent({
  categorySlug,
  page,
  sort: sortParam,
  q,
}: {
  categorySlug: string;
  page: number;
  sort?: string;
  q?: string;
}) {
  const sort: SortValue = sortParam === "newest" || sortParam === "name" ? sortParam : "rating";
  const query = q?.trim() || "";
  const { listing: data, detail: categoryDetail } = await loadCategoryPage(categorySlug, page, query);

  const categoryLabel = data?.categoryName || "Category";

  const sortedSoftwares = data
    ? query
      ? data.softwares
      : [...data.softwares].sort((a: any, b: any) => {
          if (sort === "name") return (a.name || "").localeCompare(b.name || "");
          if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return (b.rating || 0) - (a.rating || 0);
        })
    : [];

  return (
    <main className="min-h-screen bg-zinc-50/40">
      <SiteHeader />

      <section className="border-b border-zinc-100 bg-white pb-10 pt-[120px] lg:pt-[140px]">
        <Container>
          <Link
            href="/categories"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-primary-navy"
          >
            <ArrowLeft size={13} />
            All categories
          </Link>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand-green-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" aria-hidden />
            Category
          </span>
          <h1 className="mt-2 font-brand text-3xl font-bold text-primary-navy lg:text-4xl">
            Best {categoryLabel} List
          </h1>
          {data && (
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Compare {data.total} admin-verified {categoryLabel.toLowerCase()} listing
              {data.total === 1 ? "" : "s"} and find the right fit for your team.
            </p>
          )}
          {query && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
              Showing results for <span className="text-primary-navy">&ldquo;{query}&rdquo;</span>
              <Link href={`/categories/${categorySlug}`} className="text-brand-green-dark hover:underline">
                Clear search
              </Link>
            </p>
          )}
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary-navy">
                    <ArrowDownUp size={14} className="text-brand-green-dark" />
                    Sort by
                  </div>
                  <div className="space-y-1.5">
                    {sortOptions.map((opt) => (
                      <Link
                        key={opt.value}
                        href={hrefForPage(categorySlug, opt.value, query, 1)}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          sort === opt.value
                            ? "bg-brand-green/10 text-brand-green-dark"
                            : "text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {opt.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary-navy">
                    <Filter size={14} className="text-brand-green-dark" />
                    Subcategories
                  </div>
                  <div className="max-h-96 space-y-1 overflow-y-auto">
                    {(categoryDetail?.subcategories ?? [])
                      .filter((s: any) => !s.isGeneral)
                      .map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${categorySlug}/${sub.slug}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                          <span className="truncate">{sub.name}</span>
                          <span className="ml-2 shrink-0 text-xs opacity-70">{sub.count}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </aside>

            <div>
              {!data || sortedSoftwares.length === 0 ? (
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
                    {sortedSoftwares.map((software: any, idx: number) => (
                      <div
                        key={software.id}
                        className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-brand-green/40 hover:shadow-lg sm:flex-row sm:items-center"
                      >
                        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-400 sm:flex">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </span>

                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                          {software.logo ? (
                            <img
                              src={software.logo}
                              alt={software.name}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <span className="text-xl font-black text-primary-navy/25">
                              {software.name?.charAt(0)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-primary-navy transition-colors group-hover:text-brand-green-dark">
                              {software.name}
                            </h3>
                            <StarRating rating={software.rating || 0} />
                            <span className="text-xs font-bold text-zinc-400">
                              {(software.rating || 0).toFixed(1)}
                            </span>
                          </div>
                          {software.introduction && (
                            <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-zinc-500">
                              {software.introduction}
                            </p>
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
                    page={page}
                    totalPages={data.totalPages}
                    hrefForPage={(p) => hrefForPage(categorySlug, sort, query, p)}
                  />
                </>
              )}

              <div className="mt-12 overflow-hidden rounded-2xl bg-primary-navy px-8 py-10 text-center sm:px-12">
                <h3 className="font-brand text-2xl font-bold text-white">
                  Need help finding the right {categoryLabel.toLowerCase()}?
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-300">
                  Tell us what you're looking for and our team will help you shortlist the best fit
                  from the SoftwareDome directory.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-green px-8 py-3 text-sm font-bold text-primary-navy shadow-lg transition-all hover:-translate-y-0.5 hover:bg-brand-green-light"
                >
                  Talk to our team
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </main>
  );
}

# Static Categories Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/categories` and its category/subcategory listing routes from client-fetched-on-mount pages into statically pre-rendered HTML (pages 1–3 of every populated category/subcategory), while keeping search and sort fully live, so the site loads instantly and is crawlable for organic traffic.

**Architecture:** All three route levels become Server Components with `generateStaticParams` (scoped to categories/subcategories that currently have ≥1 software listing) instead of Client Components fetching via `useEffect`. Pagination moves from `?page=N` to a `/page/N` path segment so pages 1–3 can be true static HTML; a `middleware.ts` rule 301-redirects old `?page=N` links to the new path. Sort and search remain ordinary query params (`?sort=`, `?q=`) handled server-side per request — reading them naturally makes that specific request dynamic while leaving the default (no query) request served from the static cache, so no client-side "live fetch" layer is needed at all (this is a simplification over the original brainstorm, which proposed a client component swapping data in place — see note in Task 3). Freshness comes from targeted `revalidatePath` calls added to the existing software-mutation actions, not a timer.

**Tech Stack:** Next.js 16.2.5 App Router (Server Components, `generateStaticParams`, `generateMetadata`, `revalidatePath`), Prisma 7, React 19, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-21-static-categories-pages-design.md`

## Global Constraints

- Only categories/subcategories with ≥1 software listing get `generateStaticParams` entries; everything else renders on first request and is cached from then on (no rebuild required for a category to "go static").
- Only pages 1–3 are ever pre-generated per category/subcategory; page 4+ is never in `generateStaticParams` (rendered on demand via default `dynamicParams`).
- `?page=N` (no `q`) on the base category/subcategory path 301-redirects to `/page/N`; `?q=` is never redirected and never static.
- `app/categories/actions.ts`'s exported function signatures (`getCategories`, `getCategoryWithSubcategories`, `getSoftwaresByCategory`, `getSoftwaresBySubcategory`) do not change — `app/dashboard/softwares/add/page.tsx` and `edit/[id]/page.tsx` depend on them as-is.
- No experimental Next.js flags (no PPR) — plain static/dynamic Server Component rendering only.
- Canonical URLs use relative paths (`alternates.canonical: "/categories/x"`) — no `metadataBase` change, since no production domain is configured anywhere in the project yet. The sitemap is the one exception: it requires an absolute URL per the sitemap protocol, so it reads `process.env.NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000` until that env var is set in production.

---

### Task 1: Extract shared presentational components

These three components are consumed by every task below. `StarRating` and `CategoriesPagination` are pulled out of the existing client pages verbatim (no behavior change) so they can be reused from Server Components; `SiteHeader` is new — it owns the mobile-menu `useState` that the current pages currently keep in the page component itself, which won't be possible once those pages become `async` Server Components.

**Files:**
- Create: `components/StarRating.tsx`
- Create: `components/SiteHeader.tsx`
- Create: `components/CategoriesPagination.tsx`

**Interfaces:**
- Produces: `StarRating({ rating: number })` — default export, Server-Component-safe (no `"use client"`, no hooks).
- Produces: `SiteHeader()` — default export, `"use client"`, renders `<Navbar>` + `<Sidebar>` with its own mobile-menu state, no props.
- Produces: `CategoriesPagination({ page: number, totalPages: number, hrefForPage: (page: number) => string })` — default export, Server-Component-safe, renders `<Link>`s instead of buttons.

- [ ] **Step 1: Create `components/StarRating.tsx`**

```tsx
import { Star } from "@/lib/fa-icons";

export default function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rounded ? "text-amber-400 fill-amber-400" : "text-zinc-200 fill-zinc-200"}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/SiteHeader.tsx`**

```tsx
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <>
      <Navbar onMenuClick={() => setIsMenuOpen(true)} />
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Create `components/CategoriesPagination.tsx`**

```tsx
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
```

- [ ] **Step 4: Type-check the new files**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/StarRating.tsx`, `components/SiteHeader.tsx`, or `components/CategoriesPagination.tsx` (errors in unrelated pre-existing files are not this task's concern).

- [ ] **Step 5: Commit**

```bash
git add components/StarRating.tsx components/SiteHeader.tsx components/CategoriesPagination.tsx
git commit -m "refactor: extract StarRating, SiteHeader, CategoriesPagination for server-rendered category pages"
```

---

### Task 2: Make `/categories` a static Server Component

**Files:**
- Modify: `app/categories/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getCategories()` from `app/categories/actions.ts` (unchanged), `SiteHeader` (Task 1).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Rewrite `app/categories/page.tsx` as a Server Component**

Replace the entire file with:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { ChevronRight } from "@/lib/fa-icons";
import * as Icons from "@/lib/fa-icons";
import { getCategories } from "@/app/categories/actions";

export const metadata: Metadata = {
  title: "Software Categories | SoftwareDome",
  description:
    "Browse every software category in the SoftwareDome directory, from broad platforms to specific industry and role niches.",
  alternates: { canonical: "/categories" },
};

function CategoryIcon({ name }: { name: string | null }) {
  const IconComponent = (name && (Icons as any)[name]) || Icons.Box;
  return <IconComponent size={20} className="text-brand-green-dark" />;
}

export default async function CategoriesPage() {
  const res = await getCategories();
  const categories = res.success ? (res.data as any[]) : [];

  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="border-b border-zinc-100 bg-zinc-50/60 pb-12 pt-[120px] lg:pt-[140px]">
        <Container>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand-green-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" aria-hidden />
            All Products
          </span>
          <h1 className="mt-2 font-brand text-3xl font-bold text-primary-navy lg:text-4xl">
            Software categories
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Browse every software category in the SoftwareDome directory, from broad platforms to
            specific industry and role niches.
          </p>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
              <Icons.Box size={28} className="mb-3 text-zinc-300" />
              <h3 className="text-base font-bold text-primary-navy">No categories yet</h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Categories will appear here once the taxonomy has been seeded.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map((cat) => (
                <div key={cat.id} id={cat.slug} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <Link href={`/categories/${cat.slug}`} className="group mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/10">
                      <CategoryIcon name={cat.icon} />
                    </span>
                    <h2 className="font-brand text-lg font-bold text-primary-navy group-hover:text-brand-green-dark">
                      {cat.name}
                    </h2>
                  </Link>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.subcategories
                      .filter((s: any) => !s.isGeneral)
                      .map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${cat.slug}/${sub.slug}`}
                          className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-navy/80 transition-colors hover:bg-brand-green/5 hover:text-brand-green-dark"
                        >
                          <span className="truncate">{sub.name}</span>
                          <ChevronRight
                            size={13}
                            className="shrink-0 text-zinc-300 group-hover:text-brand-green-dark"
                          />
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>

      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/categories/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/categories/page.tsx
git commit -m "feat: make /categories a static server-rendered page"
```

---

### Task 3: Static category-level pages (1–3) with sort/search/pagination

Introduces the shared `CategoryPageContent` renderer plus two thin routes: `/categories/[category]` (page 1) and `/categories/[category]/page/[page]` (pages 2–3, and page 4+ rendered on demand). Both call the same content component so there's exactly one place that renders the listing markup.

**Note on the plan vs. the approved spec:** the spec described a client component that fetches live data on sort/search/pagination changes. Looking at the current implementation while writing this task, sort/search/pagination were already pure `router.push` URL navigations (not in-place AJAX swaps) — so the simpler, fully-server-rendered approach below produces identical behavior with less code and zero extra client JS: any request carrying `?sort=` or `?q=` is naturally rendered dynamically by Next (because the Server Component reads `searchParams`), while a plain request to the base path is served from the static cache. This satisfies every requirement in the spec (static default pages 1–3, live search) without a client-side data-fetching layer.

**Files:**
- Create: `app/categories/constants.ts`
- Create: `app/categories/[category]/CategoryPageContent.tsx`
- Modify: `app/categories/[category]/page.tsx` (full rewrite)
- Create: `app/categories/[category]/page/[page]/page.tsx`

**Interfaces:**
- Produces: `PAGE_SIZE = 12`, `STATIC_PAGE_LIMIT = 3` from `app/categories/constants.ts` — consumed by Task 4 too.
- Produces: `loadCategoryPage(categorySlug: string, page: number, q: string): Promise<{ listing: any; detail: any }>` (React `cache()`-wrapped) and `CategoryPageContent({ categorySlug, page, sort?, q? })` default export from `app/categories/[category]/CategoryPageContent.tsx` — consumed by both route files in this task.
- Consumes: `getSoftwaresByCategory`, `getCategoryWithSubcategories` from `app/categories/actions.ts` (unchanged); `StarRating`, `SiteHeader`, `CategoriesPagination` from Task 1.

- [ ] **Step 1: Create `app/categories/constants.ts`**

```ts
export const PAGE_SIZE = 12;
export const STATIC_PAGE_LIMIT = 3;
```

- [ ] **Step 2: Create `app/categories/[category]/CategoryPageContent.tsx`**

```tsx
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
```

- [ ] **Step 3: Rewrite `app/categories/[category]/page.tsx`**

```tsx
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import CategoryPageContent, { loadCategoryPage } from "./CategoryPageContent";

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    where: { subcategories: { some: { softwares: { some: {} } } } },
    select: { slug: true },
  });
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const { q } = await searchParams;
  const { listing } = await loadCategoryPage(category, 1, q?.trim() || "");
  const name = listing?.categoryName || category;
  return {
    title: `Best ${name} List | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { category } = await params;
  const { sort, q } = await searchParams;
  return <CategoryPageContent categorySlug={category} page={1} sort={sort} q={q} />;
}
```

- [ ] **Step 4: Create `app/categories/[category]/page/[page]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PAGE_SIZE, STATIC_PAGE_LIMIT } from "@/app/categories/constants";
import CategoryPageContent, { loadCategoryPage } from "../../CategoryPageContent";

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    select: {
      slug: true,
      subcategories: { select: { _count: { select: { softwares: true } } } },
    },
  });
  const params: { category: string; page: string }[] = [];
  for (const c of categories) {
    const total = c.subcategories.reduce((sum, s) => sum + s._count.softwares, 0);
    if (total === 0) continue;
    const totalPages = Math.min(STATIC_PAGE_LIMIT, Math.ceil(total / PAGE_SIZE));
    for (let p = 2; p <= totalPages; p++) {
      params.push({ category: c.slug, page: String(p) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; page: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { category, page } = await params;
  const { q } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const { listing } = await loadCategoryPage(category, pageNum, q?.trim() || "");
  const name = listing?.categoryName || category;
  return {
    title: `Best ${name} List — Page ${pageNum} | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/page/${pageNum}` },
  };
}

export default async function CategoryPaginatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; page: string }>;
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { category, page } = await params;
  const { sort, q } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  if (pageNum === 1) {
    const qp = new URLSearchParams();
    if (sort) qp.set("sort", sort);
    if (q) qp.set("q", q);
    const qs = qp.toString() ? `?${qp.toString()}` : "";
    redirect(`/categories/${category}${qs}`);
  }
  return <CategoryPageContent categorySlug={category} page={pageNum} sort={sort} q={q} />;
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the four files touched this task.

- [ ] **Step 6: Commit**

```bash
git add app/categories/constants.ts app/categories/[category]/CategoryPageContent.tsx app/categories/[category]/page.tsx "app/categories/[category]/page/[page]/page.tsx"
git commit -m "feat: statically pre-render category listing pages 1-3"
```

---

### Task 4: Static subcategory-level pages (1–3)

Mirrors Task 3 one level deeper: `SubcategoryPageContent` plus `/categories/[category]/[subcategory]` (page 1) and `/categories/[category]/[subcategory]/page/[page]` (pages 2–3).

**Files:**
- Create: `app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx`
- Modify: `app/categories/[category]/[subcategory]/page.tsx` (full rewrite)
- Create: `app/categories/[category]/[subcategory]/page/[page]/page.tsx`

**Interfaces:**
- Consumes: `PAGE_SIZE`, `STATIC_PAGE_LIMIT` (Task 3); `getSoftwaresBySubcategory`, `getCategoryWithSubcategories` from `app/categories/actions.ts`; `StarRating`, `SiteHeader`, `CategoriesPagination` from Task 1.
- Produces: `loadSubcategoryPage(categorySlug, subcategorySlug, page, q): Promise<{ listing: any; detail: any }>` and `SubcategoryPageContent({ categorySlug, subcategorySlug, page, sort?, q? })` default export — consumed only by the two route files in this task.

- [ ] **Step 1: Create `app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx`**

```tsx
import Link from "next/link";
import { cache } from "react";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import SiteHeader from "@/components/SiteHeader";
import CategoriesPagination from "@/components/CategoriesPagination";
import StarRating from "@/components/StarRating";
import { Box, Filter, ArrowDownUp, MessageSquare, ArrowUpRight } from "@/lib/fa-icons";
import { getSoftwaresBySubcategory, getCategoryWithSubcategories } from "@/app/categories/actions";
import { PAGE_SIZE } from "@/app/categories/constants";

const sortOptions = [
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A-Z)" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

export const loadSubcategoryPage = cache(
  async (categorySlug: string, subcategorySlug: string, page: number, q: string) => {
    const [listingRes, detailRes] = await Promise.all([
      getSoftwaresBySubcategory(categorySlug, subcategorySlug, { page, pageSize: PAGE_SIZE, q: q || undefined }),
      getCategoryWithSubcategories(categorySlug),
    ]);
    return {
      listing: listingRes.success ? (listingRes.data as any) : null,
      detail: detailRes.success ? (detailRes.data as any) : null,
    };
  }
);

function hrefForPage(
  categorySlug: string,
  subcategorySlug: string,
  sort: string,
  q: string,
  targetPage: number
): string {
  const params = new URLSearchParams();
  if (sort !== "rating") params.set("sort", sort);
  if (q) params.set("q", q);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const base = `/categories/${categorySlug}/${subcategorySlug}`;
  if (targetPage <= 1) return `${base}${suffix}`;
  return `${base}/page/${targetPage}${suffix}`;
}

export default async function SubcategoryPageContent({
  categorySlug,
  subcategorySlug,
  page,
  sort: sortParam,
  q,
}: {
  categorySlug: string;
  subcategorySlug: string;
  page: number;
  sort?: string;
  q?: string;
}) {
  const sort: SortValue = sortParam === "newest" || sortParam === "name" ? sortParam : "rating";
  const query = q?.trim() || "";
  const { listing: data, detail: categoryDetail } = await loadSubcategoryPage(
    categorySlug,
    subcategorySlug,
    page,
    query
  );

  const subcategoryLabel = data?.subcategoryName || "Subcategory";

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
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold text-zinc-500">
            <Link href="/categories" className="hover:text-primary-navy">
              All categories
            </Link>
            <span>/</span>
            <Link href={`/categories/${categorySlug}`} className="hover:text-primary-navy">
              {data?.categoryName || categoryDetail?.name || categorySlug}
            </Link>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand-green-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" aria-hidden />
            Subcategory
          </span>
          <h1 className="mt-2 font-brand text-3xl font-bold text-primary-navy lg:text-4xl">
            Best {subcategoryLabel} List
          </h1>
          {data && (
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Compare {data.total} admin-verified {subcategoryLabel.toLowerCase()} listing
              {data.total === 1 ? "" : "s"} and find the right fit for your team.
            </p>
          )}
          {query && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
              Showing results for <span className="text-primary-navy">&ldquo;{query}&rdquo;</span>
              <Link
                href={`/categories/${categorySlug}/${subcategorySlug}`}
                className="text-brand-green-dark hover:underline"
              >
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
                        href={hrefForPage(categorySlug, subcategorySlug, opt.value, query, 1)}
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
                    Other subcategories
                  </div>
                  <div className="max-h-96 space-y-1 overflow-y-auto">
                    {(categoryDetail?.subcategories ?? [])
                      .filter((s: any) => !s.isGeneral)
                      .map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${categorySlug}/${sub.slug}`}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                            sub.slug === subcategorySlug
                              ? "bg-primary-navy text-white"
                              : "text-zinc-600 hover:bg-zinc-50"
                          }`}
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
                    We couldn't find any listings for this subcategory yet. Browse other subcategories
                    instead.
                  </p>
                  <Link
                    href={`/categories/${categorySlug}`}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-green-light px-6 py-2.5 text-sm font-bold text-primary-navy shadow-sm transition-all hover:bg-brand-green hover:text-white"
                  >
                    Browse {data?.categoryName || categoryDetail?.name || "category"}
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
                    hrefForPage={(p) => hrefForPage(categorySlug, subcategorySlug, sort, query, p)}
                  />
                </>
              )}

              <div className="mt-12 overflow-hidden rounded-2xl bg-primary-navy px-8 py-10 text-center sm:px-12">
                <h3 className="font-brand text-2xl font-bold text-white">
                  Need help finding the right {subcategoryLabel.toLowerCase()}?
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
```

- [ ] **Step 2: Rewrite `app/categories/[category]/[subcategory]/page.tsx`**

```tsx
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import SubcategoryPageContent, { loadSubcategoryPage } from "./SubcategoryPageContent";

export async function generateStaticParams() {
  const subcategories = await prisma.subcategory.findMany({
    where: { softwares: { some: {} } },
    select: { slug: true, category: { select: { slug: true } } },
  });
  return subcategories.map((s) => ({ category: s.category.slug, subcategory: s.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const { q } = await searchParams;
  const { listing } = await loadSubcategoryPage(category, subcategory, 1, q?.trim() || "");
  const name = listing?.subcategoryName || subcategory;
  return {
    title: `Best ${name} List | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/${subcategory}` },
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { category, subcategory } = await params;
  const { sort, q } = await searchParams;
  return (
    <SubcategoryPageContent categorySlug={category} subcategorySlug={subcategory} page={1} sort={sort} q={q} />
  );
}
```

- [ ] **Step 3: Create `app/categories/[category]/[subcategory]/page/[page]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PAGE_SIZE, STATIC_PAGE_LIMIT } from "@/app/categories/constants";
import SubcategoryPageContent, { loadSubcategoryPage } from "../../SubcategoryPageContent";

export async function generateStaticParams() {
  const subcategories = await prisma.subcategory.findMany({
    where: { softwares: { some: {} } },
    select: {
      slug: true,
      category: { select: { slug: true } },
      _count: { select: { softwares: true } },
    },
  });
  const params: { category: string; subcategory: string; page: string }[] = [];
  for (const s of subcategories) {
    const totalPages = Math.min(STATIC_PAGE_LIMIT, Math.ceil(s._count.softwares / PAGE_SIZE));
    for (let p = 2; p <= totalPages; p++) {
      params.push({ category: s.category.slug, subcategory: s.slug, page: String(p) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; subcategory: string; page: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { category, subcategory, page } = await params;
  const { q } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const { listing } = await loadSubcategoryPage(category, subcategory, pageNum, q?.trim() || "");
  const name = listing?.subcategoryName || subcategory;
  return {
    title: `Best ${name} List — Page ${pageNum} | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/${subcategory}/page/${pageNum}` },
  };
}

export default async function SubcategoryPaginatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; subcategory: string; page: string }>;
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { category, subcategory, page } = await params;
  const { sort, q } = await searchParams;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  if (pageNum === 1) {
    const qp = new URLSearchParams();
    if (sort) qp.set("sort", sort);
    if (q) qp.set("q", q);
    const qs = qp.toString() ? `?${qp.toString()}` : "";
    redirect(`/categories/${category}/${subcategory}${qs}`);
  }
  return (
    <SubcategoryPageContent
      categorySlug={category}
      subcategorySlug={subcategory}
      page={pageNum}
      sort={sort}
      q={q}
    />
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the three files touched this task.

- [ ] **Step 5: Commit**

```bash
git add "app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx" "app/categories/[category]/[subcategory]/page.tsx" "app/categories/[category]/[subcategory]/page/[page]/page.tsx"
git commit -m "feat: statically pre-render subcategory listing pages 1-3"
```

---

### Task 5: Redirect legacy `?page=N` links to the new path

**Files:**
- Modify: `middleware.ts:9-48`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks — this is a standalone routing rule.

- [ ] **Step 1: Add the categories redirect branch and matcher entry**

In `middleware.ts`, add a new branch inside `middleware()` (before the final `return NextResponse.next();`) and extend `config.matcher`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long"
);

const ADMIN_ONLY_PREFIXES = [
  "/dashboard/users",
  "/dashboard/blogs",
  "/dashboard/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role as string;

      if (role !== "ADMIN" && role !== "VENDOR") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (role === "VENDOR" && ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }

  if (pathname.startsWith("/categories/") && !pathname.includes("/page/")) {
    const pageParam = request.nextUrl.searchParams.get("page");
    const q = request.nextUrl.searchParams.get("q");
    const pageNum = pageParam ? parseInt(pageParam, 10) : 1;

    if (!q && pageNum > 1) {
      const url = request.nextUrl.clone();
      url.pathname = `${pathname}/page/${pageNum}`;
      url.searchParams.delete("page");
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/categories/:path*"],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `middleware.ts`.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: redirect legacy ?page= category links to /page/N"
```

---

### Task 6: On-demand revalidation on software mutations

**Files:**
- Modify: `app/dashboard/softwares/actions.ts:57-69` (add helper), `:264-266` (`createSoftware`), `:301-377` (`updateSoftware`), `:390-410` (`deleteSoftware`), `:419-440` (`deleteSoftwares`), `:561-630` (`runCsvImportJob`)

**Interfaces:**
- Consumes: nothing new (uses `prisma`, already-imported `revalidatePath`).
- Produces: `revalidateCategoryPaths(subcategoryId: string | null): Promise<void>` — used only within this file.

- [ ] **Step 1: Add the `revalidateCategoryPaths` helper after `getOwnedSoftware`**

In `app/dashboard/softwares/actions.ts`, right after the `getOwnedSoftware` function (ends at line 69, before `function slugify`), add:

```ts
async function revalidateCategoryPaths(subcategoryId: string | null) {
  revalidatePath("/categories");
  if (!subcategoryId) return;

  const subcategory = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    select: { slug: true, category: { select: { slug: true } } },
  });
  if (!subcategory) return;

  const catSlug = subcategory.category.slug;
  const subSlug = subcategory.slug;
  revalidatePath(`/categories/${catSlug}`);
  revalidatePath(`/categories/${catSlug}/page/2`);
  revalidatePath(`/categories/${catSlug}/page/3`);
  revalidatePath(`/categories/${catSlug}/${subSlug}`);
  revalidatePath(`/categories/${catSlug}/${subSlug}/page/2`);
  revalidatePath(`/categories/${catSlug}/${subSlug}/page/3`);
}
```

- [ ] **Step 2: Call it from `createSoftware`**

Change (around line 264-266):

```ts
    revalidateTag("softwares");
    revalidatePath("/");
    return { success: true, data: software };
```

to:

```ts
    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(subcategoryId);
    return { success: true, data: software };
```

- [ ] **Step 3: Call it from `updateSoftware`, covering both the old and new subcategory**

First, capture the pre-update subcategory. Change (around line 298-299):

```ts
    const access = await getOwnedSoftware(id, session);
    if (access.error) return { success: false, error: access.error };
```

to:

```ts
    const access = await getOwnedSoftware(id, session);
    if (access.error) return { success: false, error: access.error };
    const oldSubcategoryId = access.software!.subcategoryId;
```

Then change (around line 370-372):

```ts
    revalidateTag("softwares");
    revalidatePath("/");
    return { success: true, data: software };
```

to:

```ts
    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(oldSubcategoryId);
    if (subcategoryId !== oldSubcategoryId) {
      await revalidateCategoryPaths(subcategoryId);
    }
    return { success: true, data: software };
```

- [ ] **Step 4: Call it from `deleteSoftware`**

Change (around line 402-405):

```ts
    await prisma.software.delete({ where: { id } });
    revalidateTag("softwares");
    revalidatePath("/");
    return { success: true };
```

to:

```ts
    await prisma.software.delete({ where: { id } });
    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(software.subcategoryId);
    return { success: true };
```

- [ ] **Step 5: Call it from `deleteSoftwares`**

Change (around line 432-435):

```ts
    const result = await prisma.software.deleteMany({ where: { id: { in: ids } } });
    revalidateTag("softwares");
    revalidatePath("/");
    return { success: true, data: { count: result.count } };
```

to:

```ts
    const result = await prisma.software.deleteMany({ where: { id: { in: ids } } });
    revalidateTag("softwares");
    revalidatePath("/");
    const uniqueSubcategoryIds = [...new Set(softwares.map((s) => s.subcategoryId))];
    for (const subId of uniqueSubcategoryIds) {
      await revalidateCategoryPaths(subId);
    }
    return { success: true, data: { count: result.count } };
```

- [ ] **Step 6: Call it after the CSV import job finishes**

Change (around line 561-567) to track touched subcategories:

```ts
async function runCsvImportJob(jobId: string, rows: CsvRow[]) {
  const state = importJobs.get(jobId);
  if (!state) return;

  const existing = await prisma.software.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((r) => r.slug));
```

to:

```ts
async function runCsvImportJob(jobId: string, rows: CsvRow[]) {
  const state = importJobs.get(jobId);
  if (!state) return;

  const existing = await prisma.software.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const touchedSubcategoryIds = new Set<string>();
```

Change (around line 579-583):

```ts
      const logoUrl = row.logo ? await uploadFromUrl(row.logo) : "";
      const subcategoryId = await resolveSubcategoryId(row.category, row.subcategory);
      if (!subcategoryId) {
        state.uncategorized = (state.uncategorized ?? 0) + 1;
      }
```

to:

```ts
      const logoUrl = row.logo ? await uploadFromUrl(row.logo) : "";
      const subcategoryId = await resolveSubcategoryId(row.category, row.subcategory);
      if (!subcategoryId) {
        state.uncategorized = (state.uncategorized ?? 0) + 1;
      } else {
        touchedSubcategoryIds.add(subcategoryId);
      }
```

Change (around line 627-629):

```ts
  state.done = true;
  // Let the client pick up the final "done" state, then free the entry.
  setTimeout(() => importJobs.delete(jobId), 60 * 60 * 1000);
}
```

to:

```ts
  state.done = true;
  if (touchedSubcategoryIds.size > 0) {
    await Promise.all([...touchedSubcategoryIds].map((subId) => revalidateCategoryPaths(subId)));
  } else {
    revalidatePath("/categories");
  }
  // Let the client pick up the final "done" state, then free the entry.
  setTimeout(() => importJobs.delete(jobId), 60 * 60 * 1000);
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/dashboard/softwares/actions.ts`.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/softwares/actions.ts
git commit -m "feat: revalidate affected category/subcategory static pages on software mutations"
```

---

### Task 7: Categories sitemap

**Files:**
- Create: `app/sitemap.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.

- [ ] **Step 1: Create `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await prisma.category.findMany({
    where: { subcategories: { some: { softwares: { some: {} } } } },
    select: {
      slug: true,
      subcategories: {
        where: { softwares: { some: {} } },
        select: { slug: true },
      },
    },
  });

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/categories`, changeFrequency: "daily", priority: 0.8 },
  ];

  for (const category of categories) {
    entries.push({
      url: `${SITE_URL}/categories/${category.slug}`,
      changeFrequency: "daily",
      priority: 0.7,
    });
    for (const sub of category.subcategories) {
      entries.push({
        url: `${SITE_URL}/categories/${category.slug}/${sub.slug}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return entries;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/sitemap.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat: add categories sitemap"
```

**Follow-up outside this plan:** set `NEXT_PUBLIC_SITE_URL` to the real production domain in the VPS environment once deployed — until then the sitemap emits `http://localhost:3000` URLs, which is harmless locally but wrong in production.

---

### Task 8: Production build verification

This is the only way to actually see static generation take effect — `next dev` always renders on demand regardless of `generateStaticParams`.

**Files:** none (verification only).

- [ ] **Step 1: Stop the dev server if one is running**

If a `next dev` process from an earlier session is still running in the background, stop it before building for production (they'd otherwise both try to bind port 3000).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds; the printed route table includes rows for `/categories`, `/categories/[category]`, `/categories/[category]/page/[page]`, `/categories/[category]/[subcategory]`, and `/categories/[category]/[subcategory]/page/[page]`, and the build log's "Generating static pages" step shows more than one page generated (at minimum: `/categories`, `/categories/emr-software`, and `/categories/emr-software/emr-software/page/2`-style entries for the currently-populated `emr-software` category/subcategory).

- [ ] **Step 3: Start the production server**

Run: `npm start` (in the background, since it stays running)

- [ ] **Step 4: Verify the index page is real static content**

Run: `curl -s http://localhost:3000/categories | grep -c "Software categories"`
Expected: `1` or more (the heading text is present in the raw HTML — proof it's server-rendered, not a client-fetched skeleton).

- [ ] **Step 5: Verify a populated category page and its canonical tag**

Run: `curl -s http://localhost:3000/categories/emr-software | grep -o 'rel="canonical" href="[^"]*"'`
Expected: `rel="canonical" href="/categories/emr-software"`.

- [ ] **Step 6: Verify the legacy `?page=` redirect**

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/categories/emr-software?page=2"`
Expected: `301` and a redirect URL ending in `/categories/emr-software/page/2`.

- [ ] **Step 7: Verify search still returns live results**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/categories/emr-software?q=test"`
Expected: `200` (dynamically rendered per-request; confirm no error in the terminal running `npm start`).

- [ ] **Step 8: Verify the sitemap**

Run: `curl -s http://localhost:3000/sitemap.xml | grep -c "<url>"`
Expected: a count ≥ 2 (at least `/categories` plus the populated `emr-software` category and its subcategory).

- [ ] **Step 9: Stop the production server**

Stop the `npm start` background process once verification is complete.

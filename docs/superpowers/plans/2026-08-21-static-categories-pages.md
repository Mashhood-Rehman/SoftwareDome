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

> **Revised during Task 3's review (see plan-level note before Task 3 below):** `hrefForPage` returns `string | null` and an optional `onPageChange` callback is supported — when `hrefForPage` returns `null` for a given page, a `<button onClick>` is rendered instead of a `<Link>`. This lets a consumer mix static-cached page links with client-side-fetched pages in the same pagination control, which Task 3 needs. Existing/future callers that always return a string and never pass `onPageChange` behave exactly as before.

```tsx
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

**Correction (discovered during this task's own review — read before implementing):** an earlier version of this task had `CategoryPageContent` read `searchParams` directly in the Server Component, on the theory that "a request carrying `?sort=`/`?q=` renders dynamically while a plain request is served from the static cache." That theory is wrong for this project: in the Next.js App Router's `prerender-legacy` path (the one active here — this repo has no `cacheComponents`/PPR flag in `next.config.ts`, and the Global Constraints forbid enabling one), reading a Dynamic API such as `searchParams` opts the **entire route** into per-request dynamic rendering — for every request, query string or not — not just the individual request that happens to carry one. That would have meant *no* request to `/categories/[category]` was ever actually served from the static cache, silently defeating this whole task.

The corrected design reverts to the original approved spec (`docs/superpowers/specs/2026-08-21-static-categories-pages-design.md` §3): `CategoryPageContent` takes only `categorySlug` and `page` — it never touches `searchParams`, so it stays genuinely static. A new Client Component, `CategoryListingClient`, owns sort/search/pagination: it reads the URL via the *client-side* `useSearchParams()` hook (this is a different API from the Server Component's `searchParams` prop and does not affect the route's static/dynamic classification, since it only runs post-hydration in the browser), and calls `getSoftwaresByCategory` directly when the URL's `sort`/`q`/`page` deviate from the server-rendered default (sort=rating, no `q`, the page the server already fetched). Plain pagination across the static pages 1–3 in the default view still uses a real `<Link>` (fast, served from the cache, no client fetch at all). `components/CategoriesPagination.tsx` (Task 1) was extended in this plan (see its Step 3, now revised) so `hrefForPage` may return `null` for a page that needs a client-side fetch instead of a static navigation — Task 1 is already merged, so this task also modifies that file.

**Files:**
- Create: `app/categories/constants.ts`
- Create: `app/categories/[category]/CategoryPageContent.tsx`
- Create: `app/categories/[category]/CategoryListingClient.tsx`
- Modify: `components/CategoriesPagination.tsx` (Task 1's file — apply the revised version from Task 1's Step 3 above, if not already applied)
- Modify: `app/categories/[category]/page.tsx` (full rewrite)
- Create: `app/categories/[category]/page/[page]/page.tsx`

**Interfaces:**
- Produces: `PAGE_SIZE = 12`, `STATIC_PAGE_LIMIT = 3` from `app/categories/constants.ts` — consumed by Task 4 too.
- Produces: `loadCategoryPage(categorySlug: string, page: number): Promise<{ listing: any; detail: any }>` (React `cache()`-wrapped, no `q` parameter — the static fetch is always the default view) and `CategoryPageContent({ categorySlug, page })` default export from `app/categories/[category]/CategoryPageContent.tsx` — consumed by both route files in this task.
- Produces: `CategoryListingClient({ categorySlug, page, staticPageLimit, initialData })` default export from `app/categories/[category]/CategoryListingClient.tsx` — consumed only by `CategoryPageContent.tsx` in this task.
- Consumes: `getSoftwaresByCategory`, `getCategoryWithSubcategories` from `app/categories/actions.ts` (unchanged); `StarRating`, `SiteHeader`, `CategoriesPagination` from Task 1 (the revised `CategoriesPagination`).

- [ ] **Step 1: Create `app/categories/constants.ts`**

```ts
export const PAGE_SIZE = 12;
export const STATIC_PAGE_LIMIT = 3;
```

- [ ] **Step 2: Apply the revised `components/CategoriesPagination.tsx` from Task 1's Step 3 above** (skip if it's already in that state)

- [ ] **Step 3: Create `app/categories/[category]/CategoryPageContent.tsx`**

```tsx
import Link from "next/link";
import { cache } from "react";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import SiteHeader from "@/components/SiteHeader";
import { ArrowLeft, Filter } from "@/lib/fa-icons";
import { getSoftwaresByCategory, getCategoryWithSubcategories } from "@/app/categories/actions";
import { PAGE_SIZE, STATIC_PAGE_LIMIT } from "@/app/categories/constants";
import CategoryListingClient from "./CategoryListingClient";

export const loadCategoryPage = cache(async (categorySlug: string, page: number) => {
  const [listingRes, detailRes] = await Promise.all([
    getSoftwaresByCategory(categorySlug, { page, pageSize: PAGE_SIZE }),
    getCategoryWithSubcategories(categorySlug),
  ]);
  return {
    listing: listingRes.success ? (listingRes.data as any) : null,
    detail: detailRes.success ? (detailRes.data as any) : null,
  };
});

export default async function CategoryPageContent({
  categorySlug,
  page,
}: {
  categorySlug: string;
  page: number;
}) {
  const { listing: data, detail: categoryDetail } = await loadCategoryPage(categorySlug, page);
  const categoryLabel = data?.categoryName || "Category";
  const staticPageLimit = data ? Math.min(STATIC_PAGE_LIMIT, data.totalPages) : STATIC_PAGE_LIMIT;

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
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
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
              <CategoryListingClient
                categorySlug={categorySlug}
                page={page}
                staticPageLimit={staticPageLimit}
                initialData={
                  data
                    ? { softwares: data.softwares, total: data.total, totalPages: data.totalPages }
                    : { softwares: [], total: 0, totalPages: 1 }
                }
              />

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

- [ ] **Step 4: Create `app/categories/[category]/CategoryListingClient.tsx`**

```tsx
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
```

- [ ] **Step 5: Rewrite `app/categories/[category]/page.tsx`**

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
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const { listing } = await loadCategoryPage(category, 1);
  const name = listing?.categoryName || category;
  return {
    title: `Best ${name} List | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return <CategoryPageContent categorySlug={category} page={1} />;
}
```

- [ ] **Step 6: Create `app/categories/[category]/page/[page]/page.tsx`**

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
}: {
  params: Promise<{ category: string; page: string }>;
}): Promise<Metadata> {
  const { category, page } = await params;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const { listing } = await loadCategoryPage(category, pageNum);
  const name = listing?.categoryName || category;
  return {
    title: `Best ${name} List — Page ${pageNum} | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/page/${pageNum}` },
  };
}

export default async function CategoryPaginatedPage({
  params,
}: {
  params: Promise<{ category: string; page: string }>;
}) {
  const { category, page } = await params;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  if (pageNum === 1) {
    redirect(`/categories/${category}`);
  }
  return <CategoryPageContent categorySlug={category} page={pageNum} />;
}
```

Note: this redirect no longer preserves `sort`/`q` query params (unlike the earlier version) — reading `searchParams` anywhere in this file, even only inside the `pageNum === 1` branch, would re-introduce the same whole-route dynamic-rendering problem this correction fixes. In practice this URL (`/page/1`) is never linked to with `sort`/`q` attached — `CategoryListingClient` only ever constructs `/page/N` links for `N >= 2` in the plain default view — so this is a defensive fallback for a stray direct hit, not a path real users take.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the files touched this task.

- [ ] **Step 8: Verify the static/dynamic rendering mode directly** (this is the check the earlier version of this task was missing — `tsc` cannot catch a rendering-mode regression)

Run: `npx next build` from the worktree root.
Expected: the build's route table shows `/categories/[category]` and `/categories/[category]/page/[page]` marked as SSG (prerendered) — not `ƒ (Dynamic)` — and the "Generating static pages" step actually emits HTML for the currently-populated `emr-software` category (page 1, and page 2/3 if it has enough software for them).

- [ ] **Step 9: Commit**

```bash
git add app/categories/constants.ts components/CategoriesPagination.tsx app/categories/[category]/CategoryPageContent.tsx app/categories/[category]/CategoryListingClient.tsx app/categories/[category]/page.tsx "app/categories/[category]/page/[page]/page.tsx"
git commit -m "feat: statically pre-render category listing pages 1-3"
```

---

### Task 4: Static subcategory-level pages (1–3)

Mirrors Task 3's (corrected) pattern one level deeper: `SubcategoryPageContent` (static, no `searchParams`) + `SubcategoryListingClient` (client, owns sort/search/pagination) plus `/categories/[category]/[subcategory]` (page 1) and `/categories/[category]/[subcategory]/page/[page]` (pages 2–3).

**Same correction as Task 3 applies here from the start** (do not repeat Task 3's original mistake): the Server Component must never read `searchParams` — that opts the entire route into per-request dynamic rendering in this project's Next.js configuration (no `cacheComponents`/PPR), not just the individual request that happens to carry a query string. All sort/search/pagination interactivity lives in the client component instead, via the client-side `useSearchParams()` hook, which does not affect the route's static/dynamic classification.

**Files:**
- Create: `app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx`
- Create: `app/categories/[category]/[subcategory]/SubcategoryListingClient.tsx`
- Modify: `app/categories/[category]/[subcategory]/page.tsx` (full rewrite)
- Create: `app/categories/[category]/[subcategory]/page/[page]/page.tsx`

**Interfaces:**
- Consumes: `PAGE_SIZE`, `STATIC_PAGE_LIMIT` (Task 3); `getSoftwaresBySubcategory`, `getCategoryWithSubcategories` from `app/categories/actions.ts`; `StarRating`, `SiteHeader`, the revised `CategoriesPagination` (Task 1, extended in Task 3) from Task 1.
- Produces: `loadSubcategoryPage(categorySlug, subcategorySlug, page): Promise<{ listing: any; detail: any }>` (no `q` — always the default view) and `SubcategoryPageContent({ categorySlug, subcategorySlug, page })` default export from `SubcategoryPageContent.tsx` — consumed by the two route files in this task.
- Produces: `SubcategoryListingClient({ categorySlug, subcategorySlug, page, staticPageLimit, initialData })` default export — consumed only by `SubcategoryPageContent.tsx`.

- [ ] **Step 1: Create `app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx`**

```tsx
import Link from "next/link";
import { cache } from "react";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import SiteHeader from "@/components/SiteHeader";
import { Filter } from "@/lib/fa-icons";
import { getSoftwaresBySubcategory, getCategoryWithSubcategories } from "@/app/categories/actions";
import { PAGE_SIZE, STATIC_PAGE_LIMIT } from "@/app/categories/constants";
import SubcategoryListingClient from "./SubcategoryListingClient";

export const loadSubcategoryPage = cache(async (categorySlug: string, subcategorySlug: string, page: number) => {
  const [listingRes, detailRes] = await Promise.all([
    getSoftwaresBySubcategory(categorySlug, subcategorySlug, { page, pageSize: PAGE_SIZE }),
    getCategoryWithSubcategories(categorySlug),
  ]);
  return {
    listing: listingRes.success ? (listingRes.data as any) : null,
    detail: detailRes.success ? (detailRes.data as any) : null,
  };
});

export default async function SubcategoryPageContent({
  categorySlug,
  subcategorySlug,
  page,
}: {
  categorySlug: string;
  subcategorySlug: string;
  page: number;
}) {
  const { listing: data, detail: categoryDetail } = await loadSubcategoryPage(categorySlug, subcategorySlug, page);
  const subcategoryLabel = data?.subcategoryName || "Subcategory";
  const staticPageLimit = data ? Math.min(STATIC_PAGE_LIMIT, data.totalPages) : STATIC_PAGE_LIMIT;

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
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
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
              <SubcategoryListingClient
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                page={page}
                staticPageLimit={staticPageLimit}
                initialData={
                  data
                    ? { softwares: data.softwares, total: data.total, totalPages: data.totalPages }
                    : { softwares: [], total: 0, totalPages: 1 }
                }
              />

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

- [ ] **Step 2: Create `app/categories/[category]/[subcategory]/SubcategoryListingClient.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CategoriesPagination from "@/components/CategoriesPagination";
import StarRating from "@/components/StarRating";
import { Box, ArrowDownUp, MessageSquare, ArrowUpRight } from "@/lib/fa-icons";
import { getSoftwaresBySubcategory } from "@/app/categories/actions";

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

export default function SubcategoryListingClient({
  categorySlug,
  subcategorySlug,
  page,
  staticPageLimit,
  initialData,
}: {
  categorySlug: string;
  subcategorySlug: string;
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
    getSoftwaresBySubcategory(categorySlug, subcategorySlug, {
      page: requestedPage,
      pageSize: PAGE_SIZE,
      q: q || undefined,
    }).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setData(res.data as ListingData);
      setCurrentPage(requestedPage);
      setLoadedKey(key);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, subcategorySlug, requestedPage, q, loadedKey]);

  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";
  const basePath = `/categories/${categorySlug}/${subcategorySlug}`;

  const handleSortChange = (newSort: SortValue) => {
    router.replace(`${basePath}?sort=${newSort}${qSuffix}`, { scroll: false });
  };

  const handlePageChange = (targetPage: number) => {
    router.replace(`${basePath}?sort=${sort}&page=${targetPage}${qSuffix}`, { scroll: false });
  };

  const hrefForPage = (targetPage: number): string | null => {
    if (q === "" && sort === "rating" && targetPage <= staticPageLimit) {
      return targetPage <= 1 ? basePath : `${basePath}/page/${targetPage}`;
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
          <Link href={basePath} className="text-brand-green-dark hover:underline">
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
            We couldn't find any listings for this subcategory yet. Browse other subcategories instead.
          </p>
          <Link
            href={`/categories/${categorySlug}`}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-green-light px-6 py-2.5 text-sm font-bold text-primary-navy shadow-sm transition-all hover:bg-brand-green hover:text-white"
          >
            Browse category
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
```

- [ ] **Step 3: Rewrite `app/categories/[category]/[subcategory]/page.tsx`**

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
}: {
  params: Promise<{ category: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const { listing } = await loadSubcategoryPage(category, subcategory, 1);
  const name = listing?.subcategoryName || subcategory;
  return {
    title: `Best ${name} List | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/${subcategory}` },
  };
}

export default async function SubcategoryPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  return <SubcategoryPageContent categorySlug={category} subcategorySlug={subcategory} page={1} />;
}
```

- [ ] **Step 4: Create `app/categories/[category]/[subcategory]/page/[page]/page.tsx`**

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
}: {
  params: Promise<{ category: string; subcategory: string; page: string }>;
}): Promise<Metadata> {
  const { category, subcategory, page } = await params;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const { listing } = await loadSubcategoryPage(category, subcategory, pageNum);
  const name = listing?.subcategoryName || subcategory;
  return {
    title: `Best ${name} List — Page ${pageNum} | SoftwareDome`,
    description: `Compare ${listing?.total ?? 0} admin-verified ${name.toLowerCase()} listings and find the right fit for your team.`,
    alternates: { canonical: `/categories/${category}/${subcategory}/page/${pageNum}` },
  };
}

export default async function SubcategoryPaginatedPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string; page: string }>;
}) {
  const { category, subcategory, page } = await params;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  if (pageNum === 1) {
    redirect(`/categories/${category}/${subcategory}`);
  }
  return <SubcategoryPageContent categorySlug={category} subcategorySlug={subcategory} page={pageNum} />;
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the files touched this task.

- [ ] **Step 6: Verify the static/dynamic rendering mode directly**

Run: `npx next build` from the worktree root.
Expected: `/categories/[category]/[subcategory]` and its `/page/[page]` variant show as SSG (prerendered), not `ƒ (Dynamic)`, and the build emits HTML for the currently-populated `emr-software/general-emr-software` subcategory.

- [ ] **Step 7: Commit**

```bash
git add "app/categories/[category]/[subcategory]/SubcategoryPageContent.tsx" "app/categories/[category]/[subcategory]/SubcategoryListingClient.tsx" "app/categories/[category]/[subcategory]/page.tsx" "app/categories/[category]/[subcategory]/page/[page]/page.tsx"
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

- [ ] **Step 7: Verify search still works**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/categories/emr-software?q=test"`
Expected: `200` (this URL is served from the same static route — search only kicks in client-side via `CategoryListingClient`'s `useSearchParams()` after hydration, so curl alone cannot confirm filtered results). If you also have browser access, load that URL and confirm the list updates to filtered/live results shortly after the page loads (a brief flash of the unfiltered default list before the correction fetch resolves is expected and acceptable).

- [ ] **Step 8: Verify the sitemap**

Run: `curl -s http://localhost:3000/sitemap.xml | grep -c "<url>"`
Expected: a count ≥ 2 (at least `/categories` plus the populated `emr-software` category and its subcategory).

- [ ] **Step 9: Stop the production server**

Stop the `npm start` background process once verification is complete.

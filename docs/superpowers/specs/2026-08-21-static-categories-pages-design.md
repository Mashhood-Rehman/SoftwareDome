# Static Categories Pages — Design Spec

**Date:** 2026-08-21
**Status:** Approved

## Problem

`/categories`, `/categories/[category]`, and `/categories/[category]/[subcategory]` are all Client Components (`"use client"`) that fetch their data via Server Actions inside `useEffect`, after mount. The initial HTML returned to any request — including search-engine crawlers — is a loading skeleton with no real content. `getCategories()` alone takes 2.5–4s per call in local testing. There is also no `generateMetadata` on any of these routes (no per-page `<title>`, description, or canonical URL), and no `sitemap.ts` in the project at all. None of this is caused by auth — `middleware.ts` only guards `/dashboard`, these routes are already publicly reachable — it's purely a rendering-strategy problem.

## Context

- `app/categories/page.tsx` — client component, fetches `getCategories()` on mount, renders a grid of category cards each listing non-general subcategories.
- `app/categories/[category]/page.tsx` — client component, reads `page`/`sort`/`q` from `useSearchParams()`, fetches `getSoftwaresByCategory()` + `getCategoryWithSubcategories()` on mount/param change, renders listing + sidebar (sort buttons, subcategory filter).
- `app/categories/[category]/[subcategory]/page.tsx` — same pattern, one level deeper, via `getSoftwaresBySubcategory()`.
- `app/categories/actions.ts` — plain `"use server"` async functions (`getCategories`, `getCategoryWithSubcategories`, `getSoftwaresByCategory`, `getSoftwaresBySubcategory`). These are also imported by `app/dashboard/softwares/add/page.tsx` and `edit/[id]/page.tsx` for the category/subcategory picker — that usage is untouched by this change.
- `app/dashboard/softwares/actions.ts` — `createSoftware`, `updateSoftware`, `deleteSoftware`, `deleteSoftwares`, and the CSV import job already call `revalidatePath("/")` on mutation. This is the hook point to extend for targeted category/subcategory revalidation.
- Current data: 45 `Software` rows total, all with `subcategoryId` set, all living under one subcategory (`emr-software/general-emr-software`). Every other category/subcategory (~30 categories, ~200 subcategories) currently has 0 software.
- `Pagination` component (`components/Pagination.tsx`) currently drives navigation via `onPageChange` → `router.push(...?page=N...)`.
- Per user's standing note (`vps_deploy_prisma_db_push` memory): schema changes need `npx prisma db push` on the VPS after deploy. Not relevant here — this spec makes no schema changes.

## Goals

- `/categories` renders real content in the initial server-rendered HTML (no client fetch, no loading skeleton for first paint).
- For every category and subcategory that currently has ≥1 software listing, pages 1–3 of its default-sorted (rating desc) listing are pre-rendered as static HTML at build/deploy time.
- Categories/subcategories with 0 listings render on-demand (SSR) on first visit and are cached from then on — no rebuild needed for a category to "go static" once it gets its first listing.
- Search (`?q=`) and sort-change and pagination past page 3 remain fully live/dynamic, fetching through the existing server actions — behavior unchanged from the user's point of view, just implemented over a static base instead of a fully client-fetched one.
- Old `?page=N` links (without `q`) redirect (301) to the new `/page/N` path so bookmarks/indexed URLs keep working.
- Each of the three route levels gets real `generateMetadata` (title, description, canonical).
- A minimal `sitemap.ts` lists `/categories` plus every currently-populated category/subcategory URL.
- Admin mutations to software (create/update/delete/bulk-delete/CSV import) trigger targeted revalidation of the specific `/categories`, `/categories/[category]`, and `/categories/[category]/[subcategory]` paths affected, not just `/`.

## Non-Goals

- No change to the visual design of these pages — same layout, same Tailwind classes, same components (`Pagination`, `StarRating`, sidebar, CTA banner).
- No change to `app/categories/actions.ts`'s public function signatures — dashboard usages keep working unmodified.
- No Partial Prerendering (Next's experimental PPR) — not stable enough in the current Next 16.2.5 setup to depend on; the static-shell + client-takeover pattern below achieves the same practical outcome without an experimental flag.
- No pre-rendering of empty (0-listing) categories/subcategories — they stay dynamic-on-first-request per the approved answer, to avoid publishing thin-content pages.
- No full sitemap infrastructure (news sitemap, image sitemap, sitemap index) — just one flat `sitemap.ts` covering categories.

## Design

### 1. URL structure

| Old | New |
|---|---|
| `/categories/[category]?page=1` | `/categories/[category]` (page 1, static) |
| `/categories/[category]?page=2` | `/categories/[category]/page/2` (static) |
| `/categories/[category]?page=3` | `/categories/[category]/page/3` (static) |
| `/categories/[category]?page=4+` | `/categories/[category]/page/4` (rendered on first request, cached — not pre-built) |
| `/categories/[category]/[subcategory]?page=N` | same `/page/[n]` pattern one level deeper |
| `/categories/[category]?q=...` (any page) | unchanged — search is never static, no redirect |

`middleware.ts` (currently scoped only to `/dashboard`) gets a second matcher entry for `/categories/:category*`: if the request has `?page=N` (N > 1) and no `q`, it redirects (301) to the equivalent `/page/N` path. Handling this in middleware — rather than inside the static page components — keeps the static Server Components free of any per-request logic.

### 2. Rendering strategy

- `app/categories/page.tsx` becomes a Server Component. It calls `getCategories()` directly (server actions are plain async functions — callable directly from a Server Component, no client round-trip needed) and renders the full grid server-side. `export const revalidate` is not time-based; freshness comes from on-demand `revalidatePath("/categories")` (see §4).
- `app/categories/[category]/page.tsx` and the new `app/categories/[category]/page/[page]/page.tsx` (plus the subcategory equivalents) become Server Components with `generateStaticParams()`:
  - Category-level: enumerate categories with ≥1 software, times pages `[1,2,3]` capped at that category's actual `totalPages`.
  - Subcategory-level: same, per subcategory.
  - `dynamicParams` stays at its default (`true`), so a category/page combo outside the pre-generated list (either because it's page 4+, or because the category had 0 software at build time) renders on first request and is cached afterward — this is what makes a newly-populated category "go static" without a rebuild.
- Each Server Component fetches its default view (sort=rating, no `q`) via the existing `getSoftwaresByCategory`/`getSoftwaresBySubcategory` actions and server-renders the real list markup — this is what search engines and the "no-JS" initial paint see.

### 3. Interactive layer (sort / search / deep pagination)

- The server-rendered list markup is passed as initial data into a small Client Component (e.g. `CategoryListingClient`) that owns:
  - The sort dropdown (rating/newest/name).
  - The search box (`q`).
  - Pagination controls.
- On mount it does nothing (avoids the double-fetch-on-load problem the current pages have) — it only fetches when the user actually changes sort, types a search query, or moves to a page it doesn't already have data for. Those fetches call the existing `getSoftwaresByCategory`/`getSoftwaresBySubcategory` server actions directly (already client-callable) and swap the rendered list in place.
- Plain navigation across the pre-rendered pages 1–3 (default sort, no search) uses real `<Link href="/categories/x/page/2">`, so it's served from the static cache with no fetch at all — the client component only takes over once the user deviates from that default path (sort change, search, or paging past what's cached).
- `router.replace` updates the URL to reflect live sort/search/page state for shareability, without a full navigation/remount.

### 4. On-demand revalidation

In `app/dashboard/softwares/actions.ts`, `createSoftware`, `updateSoftware`, `deleteSoftware`, `deleteSoftwares`, and the CSV import completion path look up the affected software's subcategory → category slug (for `updateSoftware`, both the old and new subcategory if it changed) and call:

```ts
revalidatePath("/categories");
revalidatePath(`/categories/${categorySlug}`);
revalidatePath(`/categories/${categorySlug}/${subcategorySlug}`);
```

in addition to the existing `revalidatePath("/")`. Bulk CSV import revalidates the distinct set of affected category/subcategory paths once at the end of the job, not per-row.

### 5. SEO additions

- `generateMetadata` on all three route levels (index, category, subcategory — including the `/page/[n]` variants): `<title>`, meta description, and canonical URL built from category/subcategory name and current listing count.
- `app/sitemap.ts`: a `MetadataRoute.Sitemap` listing `/categories` plus one entry per category and populated subcategory (querying the same `Category`/`Subcategory` tables, filtered to `_count.softwares > 0` for subcategories, consistent with the static-generation scope in §2).

### 6. Testing

- `next build && next start` (static generation only takes effect in a production build, not `next dev`) — confirm via build output which category/subcategory/page routes were pre-rendered (○/●  markers) vs left dynamic.
- Manual pass against the running build:
  - `/categories` — real content in `view-source`, no skeleton.
  - `/categories/emr-software` and `/page/2` if it has enough rows — static, instant.
  - A category with 0 software — first hit renders (slower), second hit is cached.
  - Old `?page=2` link redirects to `/page/2`.
  - Search box still returns live, correct results.
  - Editing a software in the dashboard and reloading the public category page reflects the change without a rebuild.

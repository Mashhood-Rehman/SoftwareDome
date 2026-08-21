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

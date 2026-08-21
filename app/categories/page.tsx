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

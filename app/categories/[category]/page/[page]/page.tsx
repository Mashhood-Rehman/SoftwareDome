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

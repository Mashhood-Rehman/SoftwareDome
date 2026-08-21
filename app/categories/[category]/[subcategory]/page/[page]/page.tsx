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

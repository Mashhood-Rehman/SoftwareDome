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

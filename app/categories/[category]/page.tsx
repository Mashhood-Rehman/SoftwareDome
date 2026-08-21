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

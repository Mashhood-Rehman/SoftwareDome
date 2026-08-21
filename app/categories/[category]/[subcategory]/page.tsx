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

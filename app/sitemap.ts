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

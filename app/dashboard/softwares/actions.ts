"use server";

import { randomUUID } from "crypto";
import { parse } from "csv-parse/sync";
import { unstable_cache, revalidateTag as _revalidateTag, revalidatePath } from "next/cache";
const revalidateTag = _revalidateTag as unknown as (tag: string) => void;
import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { requireAdmin } from "@/lib/require-admin";
import {
  getDashboardSession,
  isAdmin,
  requireDashboardUser,
  type DashboardSession,
} from "@/lib/require-dashboard";
import { getCategories } from "@/app/categories/actions";

const fetchSoftwares = unstable_cache(
  async () =>
    prisma.software.findMany({
      orderBy: { createdAt: "desc" },
      include: { subcategory: { include: { category: true } } },
    }),
  ["softwares-list"],
  { revalidate: 60, tags: ["softwares"] }
);

export async function getSoftwares() {
  try {
    const softwares = await fetchSoftwares();
    return { success: true, data: softwares };
  } catch (error) {
    console.error("Error fetching softwares:", error);
    return { success: false, error: "Failed to fetch softwares" };
  }
}

export async function getDashboardSoftwares() {
  try {
    const session = await getDashboardSession();
    if (!session) {
      return { success: false, error: "Not authenticated." };
    }

    const softwares = await prisma.software.findMany({
      where: isAdmin(session) ? undefined : { vendorId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { subcategory: { include: { category: true } } },
    });
    return { success: true, data: softwares };
  } catch (error) {
    console.error("Error fetching dashboard softwares:", error);
    return { success: false, error: "Failed to fetch softwares" };
  }
}

async function getOwnedSoftware(id: string, session: DashboardSession) {
  const software = await prisma.software.findUnique({
    where: { id },
    include: { subcategory: { include: { category: true } } },
  });
  if (!software) {
    return { error: "Software not found." as const, software: null };
  }
  if (!isAdmin(session) && software.vendorId !== session.userId) {
    return { error: "You do not have permission to access this software." as const, software: null };
  }
  return { software, error: null };
}

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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function nameMatchScore(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return 3;
}

// Resolves a free-text search term (typed into the hero/sidebar search bars) to the
// category page it should land on: a direct category-name match wins, otherwise we
// fall back to the category of the software whose name best matches the query.
export async function findBestCategoryForQuery(query: string) {
  try {
    const q = query.trim();
    if (!q) return { success: true, data: null };

    const categoriesRes = await getCategories();
    const categories = categoriesRes.success ? categoriesRes.data || [] : [];

    const qLower = q.toLowerCase();
    const directCategory = categories.find(
      (c) => c.name.toLowerCase().includes(qLower) || qLower.includes(c.name.toLowerCase())
    );
    if (directCategory) {
      return {
        success: true,
        data: { categorySlug: directCategory.slug, subcategorySlug: null, categoryName: directCategory.name },
      };
    }

    const matches = await prisma.software.findMany({
      where: { name: { contains: q, mode: "insensitive" }, subcategoryId: { not: null } },
      select: {
        name: true,
        subcategory: { select: { slug: true, category: { select: { slug: true, name: true } } } },
      },
    });
    if (matches.length === 0) return { success: true, data: null };

    const best = matches.reduce((a, b) => (nameMatchScore(a.name, q) <= nameMatchScore(b.name, q) ? a : b));
    if (!best.subcategory) return { success: true, data: null };

    return {
      success: true,
      data: {
        categorySlug: best.subcategory.category.slug,
        subcategorySlug: best.subcategory.slug,
        categoryName: best.subcategory.category.name,
      },
    };
  } catch (error) {
    console.error("Error resolving search category:", error);
    return { success: false, error: "Failed to resolve search category" };
  }
}

// Powers the search-bar typeahead: returns the best 5 name matches for a
// partial query, ranked by closeness (exact > starts-with > contains) and
// then by rating.
export async function searchSoftwareSuggestions(query: string) {
  try {
    const q = query.trim();
    if (!q) return { success: true, data: [] };

    const matches = await prisma.software.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        rating: true,
        subcategory: { select: { name: true } },
      },
      take: 20,
    });

    const ranked = matches
      .sort((a, b) => {
        const scoreDiff = nameMatchScore(a.name, q) - nameMatchScore(b.name, q);
        return scoreDiff !== 0 ? scoreDiff : (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 5);

    return { success: true, data: ranked };
  } catch (error) {
    console.error("Error searching software suggestions:", error);
    return { success: false, error: "Failed to search softwares" };
  }
}

async function uploadToCloudinary(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "softwares" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || "");
      }
    );
    uploadStream.end(buffer);
  });
}

export async function createSoftware(formData: FormData) {
  try {
    const auth = await requireDashboardUser();
    if (auth.error) return { success: false, error: "Not authenticated." };
    const { session } = auth;

    const name = formData.get("name") as string;
    const subcategoryId = (formData.get("subcategoryId") as string) || null;
    const introduction = formData.get("introduction") as string;
    const ourVerdict = formData.get("ourVerdict") as string;
    const rating = parseFloat(formData.get("rating") as string) || 0;
    const reportUrl = formData.get("reportUrl") as string;

    const howItWorks = formData.get("howItWorks") as string;
    const whoIsItFor = formData.get("whoIsItFor") as string;
    const howItIsDifferent = formData.get("howItIsDifferent") as string;

    // Arrays
    const keyTakeaways = JSON.parse(formData.get("keyTakeaways") as string || "[]");
    const pros = JSON.parse(formData.get("pros") as string || "[]");
    const cons = JSON.parse(formData.get("cons") as string || "[]");

    // JSON fields
    const specifications = JSON.parse(formData.get("specifications") as string || "{}");
    const faqs = JSON.parse(formData.get("faqs") as string || "[]");
    const sentiments = JSON.parse(formData.get("sentiments") as string || "[]");

    if (!name) {
      return { success: false, error: "Software name is required" };
    }

    const slug = slugify(name);

    const existingSoftware = await prisma.software.findUnique({
      where: { slug },
    });

    if (existingSoftware) {
      return { success: false, error: "A software with this name/slug already exists" };
    }

    // Handle Image Uploads
    let logoUrl = "";
    const logoFile = formData.get("logo") as File;
    if (logoFile && logoFile.size > 0) {
      logoUrl = await uploadToCloudinary(logoFile);
    }

    const pictureUrls: string[] = [];
    const pictures = formData.getAll("pictures") as File[];
    for (const pic of pictures) {
      if (pic && pic instanceof File && pic.size > 0) {
        const url = await uploadToCloudinary(pic);
        pictureUrls.push(url);
      }
    }

    const software = await prisma.software.create({
      data: {
        name,
        slug,
        logo: logoUrl,
        subcategoryId,
        rating,
        reportUrl,
        introduction,
        ourVerdict,
        keyTakeaways,
        pros,
        cons,
        pictures: pictureUrls,
        howItWorks,
        whoIsItFor,
        howItIsDifferent,
        sentiments,
        specifications,
        faqs,
        vendorId: isAdmin(session) ? null : session.userId,
      },
    });

    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(subcategoryId);
    return { success: true, data: software };
  } catch (error) {
    console.error("Error creating software:", error);
    return { success: false, error: "Failed to create software" };
  }
}

export async function getSoftwareById(id: string) {
  try {
    const session = await getDashboardSession();
    if (!session) {
      return { success: false, error: "Not authenticated." };
    }

    const access = await getOwnedSoftware(id, session);
    if (access.error) {
      return { success: false, error: access.error };
    }

    return { success: true, data: access.software };
  } catch (error) {
    console.error("Error fetching software by ID:", error);
    return { success: false, error: "Failed to fetch software" };
  }
}

export async function updateSoftware(id: string, formData: FormData) {
  try {
    const auth = await requireDashboardUser();
    if (auth.error) return { success: false, error: "Not authenticated." };
    const { session } = auth;

    const access = await getOwnedSoftware(id, session);
    if (access.error) return { success: false, error: access.error };
    const oldSubcategoryId = access.software!.subcategoryId;

    const name = formData.get("name") as string;
    const subcategoryId = (formData.get("subcategoryId") as string) || null;
    const introduction = formData.get("introduction") as string;
    const ourVerdict = formData.get("ourVerdict") as string;
    const rating = parseFloat(formData.get("rating") as string) || 0;
    const reportUrl = formData.get("reportUrl") as string;

    const howItWorks = formData.get("howItWorks") as string;
    const whoIsItFor = formData.get("whoIsItFor") as string;
    const howItIsDifferent = formData.get("howItIsDifferent") as string;

    const keyTakeaways = JSON.parse(formData.get("keyTakeaways") as string || "[]");
    const pros = JSON.parse(formData.get("pros") as string || "[]");
    const cons = JSON.parse(formData.get("cons") as string || "[]");

    const specifications = JSON.parse(formData.get("specifications") as string || "{}");
    const faqs = JSON.parse(formData.get("faqs") as string || "[]");
    const sentiments = JSON.parse(formData.get("sentiments") as string || "[]");

    if (!name) {
      return { success: false, error: "Software name is required" };
    }

    const slug = slugify(name);
    const slugOwner = await prisma.software.findUnique({ where: { slug } });
    if (slugOwner && slugOwner.id !== id) {
      return { success: false, error: "A software with this name/slug already exists" };
    }

    const updateData: any = {
      name,
      slug,
      subcategoryId,
      rating,
      reportUrl,
      introduction,
      ourVerdict,
      keyTakeaways,
      pros,
      cons,
      howItWorks,
      whoIsItFor,
      howItIsDifferent,
      sentiments,
      specifications,
      faqs,
    };

    // Handle Image Uploads conditionally
    const logoFile = formData.get("logo") as File;
    if (logoFile && logoFile.size > 0) {
      updateData.logo = await uploadToCloudinary(logoFile);
    }

    const pictureUrls: string[] = JSON.parse(formData.get("existingPictures") as string || "[]");
    const newPictures = formData.getAll("pictures") as File[];
    for (const pic of newPictures) {
      if (pic && pic instanceof File && pic.size > 0) {
        const url = await uploadToCloudinary(pic);
        pictureUrls.push(url);
      }
    }
    updateData.pictures = pictureUrls;

    const software = await prisma.software.update({
      where: { id },
      data: updateData,
    });

    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(oldSubcategoryId);
    if (subcategoryId !== oldSubcategoryId) {
      await revalidateCategoryPaths(subcategoryId);
    }
    return { success: true, data: software };
  } catch (error) {
    console.error("Error updating software:", error);
    return { success: false, error: "Failed to update software" };
  }
}

function cloudinaryPublicId(url: string): string {
  return url.split("/").slice(-2).join("/").replace(/\.[a-zA-Z]+$/, "");
}

export async function deleteSoftware(id: string) {
  try {
    const auth = await requireDashboardUser();
    if (auth.error) return { success: false, error: "Not authenticated." };
    const { session } = auth;

    const access = await getOwnedSoftware(id, session);
    if (access.error) return { success: false, error: access.error };
    const software = access.software!;

    const assetUrls = [software.logo, ...(software.pictures || [])].filter(Boolean) as string[];
    for (const url of assetUrls) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId(url));
      } catch (err) {
        console.error("Failed to remove Cloudinary asset:", url, err);
      }
    }

    await prisma.software.delete({ where: { id } });
    revalidateTag("softwares");
    revalidatePath("/");
    await revalidateCategoryPaths(software.subcategoryId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting software:", error);
    return { success: false, error: "Failed to delete software" };
  }
}

export async function deleteSoftwares(ids: string[]) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    if (!ids.length) return { success: false, error: "No softwares selected." };

    const softwares = await prisma.software.findMany({ where: { id: { in: ids } } });

    for (const software of softwares) {
      const assetUrls = [software.logo, ...(software.pictures || [])].filter(Boolean) as string[];
      for (const url of assetUrls) {
        try {
          await cloudinary.uploader.destroy(cloudinaryPublicId(url));
        } catch (err) {
          console.error("Failed to remove Cloudinary asset:", url, err);
        }
      }
    }

    const result = await prisma.software.deleteMany({ where: { id: { in: ids } } });
    revalidateTag("softwares");
    revalidatePath("/");
    const uniqueSubcategoryIds = [...new Set(softwares.map((s) => s.subcategoryId))];
    for (const subId of uniqueSubcategoryIds) {
      await revalidateCategoryPaths(subId);
    }
    return { success: true, data: { count: result.count } };
  } catch (error) {
    console.error("Error deleting softwares:", error);
    return { success: false, error: "Failed to delete softwares" };
  }
}

export async function getSoftwareBySlug(slug: string) {
  try {
    const software = await prisma.software.findUnique({
      where: { slug },
      include: {
        _count: { select: { reviews: true } },
        subcategory: { include: { category: true } },
      },
    });
    return { success: true, data: software };
  } catch (error) {
    console.error("Error fetching software by slug:", error);
    return { success: false, error: "Failed to fetch software" };
  }
}

type CsvRow = {
  name: string;
  slug: string;
  logo: string;
  category: string;
  subcategory: string;
  rating: string;
  reportUrl: string;
  introduction: string;
  ourVerdict: string;
  keyTakeaways: string;
  pros: string;
  cons: string;
  pictures: string;
  howItWorks: string;
  whoIsItFor: string;
  howItIsDifferent: string;
  sentiments: string;
  specifications: string;
  faqs: string;
};

function parseJsonArray(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonAny(value: string | undefined): unknown {
  if (!value || !value.trim()) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (!value || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function uploadFromUrl(url: string): Promise<string> {
  const res = await cloudinary.uploader.upload(url, { folder: "softwares" });
  return res.secure_url;
}

// Pulls work off a shared queue with at most `limit` uploads in flight at once —
// keeps large imports fast without hammering Cloudinary's rate limits.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index]);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
}

type ImportJobState = {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  uncategorized?: number;
  errors: string[];
  done: boolean;
};

// In-memory job registry. Fine as long as the app runs as a single persistent
// Node process (e.g. one PM2 instance) — a CSV import kicked off here keeps
// running after the request returns, since there's no serverless teardown.
const importJobs = new Map<string, ImportJobState>();

async function resolveSubcategoryId(categoryName: string | undefined, subcategoryName: string | undefined): Promise<string | null> {
  if (!categoryName) return null;
  const category = await prisma.category.findFirst({
    where: { name: { equals: categoryName.trim(), mode: "insensitive" } },
  });
  if (!category) return null;

  if (subcategoryName?.trim()) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { categoryId: category.id, name: { equals: subcategoryName.trim(), mode: "insensitive" } },
    });
    if (subcategory) return subcategory.id;
  }

  const general = await prisma.subcategory.findFirst({ where: { categoryId: category.id, isGeneral: true } });
  return general?.id ?? null;
}

async function runCsvImportJob(jobId: string, rows: CsvRow[]) {
  const state = importJobs.get(jobId);
  if (!state) return;

  const existing = await prisma.software.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const touchedSubcategoryIds = new Set<string>();

  await runWithConcurrency(rows, 6, async (row) => {
    try {
      if (!row.name || !row.slug) return;
      if (existingSlugs.has(row.slug)) {
        state.skipped++;
        return;
      }
      // Reserve the slug immediately so two rows sharing a slug can't both pass
      // the check and race each other into a duplicate-key DB error.
      existingSlugs.add(row.slug);

      const logoUrl = row.logo ? await uploadFromUrl(row.logo) : "";
      const subcategoryId = await resolveSubcategoryId(row.category, row.subcategory);
      if (!subcategoryId) {
        state.uncategorized = (state.uncategorized ?? 0) + 1;
      } else {
        touchedSubcategoryIds.add(subcategoryId);
      }

      const pictureUrls: string[] = [];
      for (const pic of parseJsonArray(row.pictures)) {
        try {
          pictureUrls.push(await uploadFromUrl(pic));
        } catch (err) {
          console.error(`Picture upload failed for ${row.slug}:`, pic, err);
        }
      }

      await (prisma.software as any).create({
        data: {
          name: row.name,
          slug: row.slug,
          logo: logoUrl,
          subcategoryId,
          rating: parseFloat(row.rating) || 0,
          reportUrl: row.reportUrl || null,
          introduction: row.introduction || null,
          ourVerdict: row.ourVerdict || null,
          keyTakeaways: parseJsonArray(row.keyTakeaways),
          pros: parseJsonArray(row.pros),
          cons: parseJsonArray(row.cons),
          pictures: pictureUrls,
          howItWorks: row.howItWorks || null,
          whoIsItFor: row.whoIsItFor || null,
          howItIsDifferent: row.howItIsDifferent || null,
          sentiments: parseJsonAny(row.sentiments) as any,
          specifications: parseJsonObject(row.specifications),
          faqs: parseJsonAny(row.faqs) as any,
        },
      });

      state.created++;
    } catch (err) {
      console.error(`Failed to import row ${row.slug}:`, err);
      state.failed++;
      state.errors.push(row.slug);
    } finally {
      state.processed++;
    }
  });

  state.done = true;
  if (touchedSubcategoryIds.size > 0) {
    await Promise.all([...touchedSubcategoryIds].map((subId) => revalidateCategoryPaths(subId)));
  } else {
    revalidatePath("/categories");
  }
  // Let the client pick up the final "done" state, then free the entry.
  setTimeout(() => importJobs.delete(jobId), 60 * 60 * 1000);
}

export async function importSoftwaresFromCsv(formData: FormData) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "No CSV file provided." };
    }

    const content = await file.text();
    let rows: CsvRow[];
    try {
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      });
    } catch {
      return { success: false, error: "Failed to parse CSV file." };
    }

    const jobId = randomUUID();
    importJobs.set(jobId, {
      total: rows.length,
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      uncategorized: 0,
      errors: [],
      done: false,
    });

    // Not awaited on purpose — the CSV can be thousands of rows, each needing a
    // Cloudinary round-trip, which would otherwise hold the request open until
    // a proxy/timeout kills it. The client polls getImportJobStatus for progress.
    runCsvImportJob(jobId, rows).catch((err) => {
      console.error("CSV import job crashed:", err);
      const state = importJobs.get(jobId);
      if (state) state.done = true;
    });

    return { success: true, data: { jobId, total: rows.length } };
  } catch (error) {
    console.error("Error starting CSV import:", error);
    return { success: false, error: "Failed to import CSV" };
  }
}

export async function getImportJobStatus(jobId: string) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return { success: false, error: "Admin access required." };

    const state = importJobs.get(jobId);
    if (!state) return { success: false, error: "Import job not found or already expired." };

    return { success: true, data: state };
  } catch (error) {
    console.error("Error fetching import job status:", error);
    return { success: false, error: "Failed to fetch import status" };
  }
}

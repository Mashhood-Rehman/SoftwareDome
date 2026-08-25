"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownUp,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  CheckCircle,
  XCircle,
  Lightbulb,
  Users,
  GitCompare,
  Box,
  BookOpen,
  Zap,
  Layers,
  TrendingUp,
  Settings,
  Info,
  ShieldCheck,
  MessageSquare,
  Calendar,
  X,
} from "@/lib/fa-icons";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import CompactSectionHeader from "@/components/CompactSectionHeader";
import SoftwareReviews from "@/components/SoftwareReviews";
import DemoRequestForm from "@/components/DemoRequestForm";
import { useInView } from "@/hooks/useInView";
import { getSoftwareBySlug } from "@/app/dashboard/softwares/actions";

type FaqItem = { question?: string; answer?: string };
type SentimentRow = { theme?: string; sentiment?: string; summary?: string };
type SoftwareRecord = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  subcategory?: {
    name: string;
    slug: string;
    category: { name: string; slug: string };
  } | null;
  rating: number | null;
  reportUrl: string | null;
  introduction: string | null;
  ourVerdict: string | null;
  keyTakeaways: string[];
  pros: string[];
  cons: string[];
  pictures: string[];
  howItWorks: string | null;
  whoIsItFor: string | null;
  howItIsDifferent: string | null;
  sentiments: SentimentRow[] | null;
  specifications: Record<string, string> | null;
  faqs: FaqItem[] | null;
  vendorId?: string | null;
  _count?: { reviews: number };
  createdAt: Date | string;
  updatedAt: Date | string;
};

const sections = [
  { id: "introduction", label: "Introduction", icon: BookOpen },
  { id: "verdict", label: "Verdict", icon: Zap },
  { id: "takeaways", label: "Takeaways", icon: CheckCircle },
  { id: "pros-cons", label: "Pros & cons", icon: ArrowDownUp },
  { id: "gallery", label: "Gallery", icon: ImageIcon },
  { id: "deep-dive", label: "Deep dive", icon: Layers },
  { id: "sentiments", label: "Market sentiment", icon: TrendingUp },
  { id: "specifications", label: "Specifications", icon: Settings },
  { id: "faqs", label: "FAQs", icon: Info },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
];

const deepDiveIcons: Record<string, React.ElementType> = {
  "how-it-works": Lightbulb,
  "who-is-it-for": Users,
  "how-it-is-different": GitCompare,
};

function filterStrings(items: string[] | undefined | null) {
  return (items || [])
    .filter((s) => s !== null && s !== undefined)
    .map((s) => (typeof s === "string" ? s : String(s)))
    .filter((s) => s.trim());
}

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProseBlock({ text }: { text: string }) {
  return (
    <p className="max-w-3xl text-base leading-relaxed text-text-muted whitespace-pre-line">{text}</p>
  );
}

function EmptyBlock({ message, icon: Icon }: { message: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-muted/60 px-5 py-5 text-text-muted/70">
      {Icon && <Icon size={16} className="shrink-0" />}
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  );
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rounded ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"}
        />
      ))}
    </div>
  );
}

function SentimentPill({ value }: { value: string }) {
  const v = value.toLowerCase();
  const styles =
    v === "positive"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : v === "negative"
      ? "bg-red-50 text-red-700 ring-red-200"
      : v === "mixed"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${styles}`}>
      {value}
    </span>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useInView(0.1);
  return (
    <div ref={ref} className={`${visible ? "landing-rise" : "opacity-0"} ${className}`}>
      {children}
    </div>
  );
}

export default function SoftwareDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [software, setSoftware] = useState<SoftwareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Record<number, boolean>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [activeDeepDiveId, setActiveDeepDiveId] = useState("");
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        const res = await getSoftwareBySlug(slug);
        if (res.success && res.data) {
          setSoftware(res.data as SoftwareRecord);
        } else {
          setSoftware(null);
        }
      } catch (err) {
        console.error("Error loading software detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Derived view models — computed unconditionally (with optional chaining) so the
  // hooks below can safely depend on them regardless of the loading/not-found state.
  const rawSpecs = software?.specifications;
  const specifications = rawSpecs && typeof rawSpecs === "object" ? (rawSpecs as Record<string, string>) : {};
  const specEntries = Object.entries(specifications)
    .map(([k, v]) => [k, v === null || v === undefined ? "" : typeof v === "string" ? v : String(v)] as [string, string])
    .filter(([, v]) => v.trim());

  const rawFaqs = software?.faqs;
  const faqs = Array.isArray(rawFaqs) ? (rawFaqs as FaqItem[]) : [];
  const validFaqs = faqs.filter((f) => typeof f?.question === "string" && f.question.trim());

  const rawSentiments = software?.sentiments;
  const sentiments = Array.isArray(rawSentiments) ? (rawSentiments as SentimentRow[]) : [];
  const validSentiments = sentiments.filter((s) => typeof s?.theme === "string" && s.theme.trim());

  const takeaways = filterStrings(software?.keyTakeaways);
  const pros = filterStrings(software?.pros);
  const cons = filterStrings(software?.cons);
  const pictures = filterStrings(software?.pictures);
  const rating = software?.rating ?? 0;
  const reviewCount = software?._count?.reviews ?? 0;

  const deepDive = [
    { id: "how-it-works", title: "How it works", body: software?.howItWorks },
    { id: "who-is-it-for", title: "Who it is for", body: software?.whoIsItFor },
    { id: "how-it-is-different", title: "How it is different", body: software?.howItIsDifferent },
  ].filter((s) => s.body?.trim());
  const activeDeepDiveBlock = deepDive.find((b) => b.id === activeDeepDiveId) ?? deepDive[0];

  // Scroll-spy — highlights whichever section is currently in view in the side nav.
  useEffect(() => {
    if (!software) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [software]);

  // Hero visibility — toggles the compact sticky header once the hero card scrolls out of view.
  useEffect(() => {
    if (!software) return;
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { rootMargin: "-110px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [software]);

  // Lightbox keyboard controls (Escape to close, arrows to navigate).
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveImage((i) => (i + 1) % pictures.length);
      if (e.key === "ArrowLeft") setActiveImage((i) => (i - 1 + pictures.length) % pictures.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, pictures.length]);

  // Demo modal — Escape to close.
  useEffect(() => {
    if (!demoModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDemoModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoModalOpen]);

  function scrollToDemo() {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    document
      .getElementById(isDesktop ? "demo-desktop" : "demo-mobile")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-muted">
        <Navbar onMenuClick={() => setIsMenuOpen(true)} />
        <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <Container className="pt-[120px] pb-8 lg:pt-[140px] lg:pb-10">
          <div className="mb-8 h-4 w-32 animate-pulse rounded-full bg-border-subtle" />
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
            <div className="space-y-6">
              <div className="h-44 animate-pulse rounded-3xl border border-border-subtle bg-white" />
              <div className="h-28 animate-pulse rounded-3xl border border-border-subtle bg-white" />
              <div className="h-64 animate-pulse rounded-3xl border border-border-subtle bg-white" />
            </div>
            <div className="mt-6 hidden h-96 animate-pulse rounded-3xl border border-border-subtle bg-white lg:mt-0 lg:block" />
          </div>
        </Container>
        <Footer />
      </main>
    );
  }

  if (!software) {
    return (
      <main className="min-h-screen bg-surface-muted">
        <Navbar onMenuClick={() => setIsMenuOpen(true)} />
        <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green-dark">
            <Box size={22} />
          </div>
          <h1 className="mt-5 text-xl font-black text-primary-navy">Profile not in index</h1>
          <p className="mt-2 text-sm text-text-muted">
            This software slug does not exist or was removed from the catalog.
          </p>
          <Button href="/#catalog" icon={ArrowLeft} className="mt-6">
            Back to catalog
          </Button>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-muted">
      <Navbar onMenuClick={() => setIsMenuOpen(true)} />
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Compact sticky header — appears once the hero card scrolls out of view.
          Mirrors the page grid so it stays confined to the main column and never
          overlaps the demo form / section index in the right sidebar. */}
      {!heroVisible && (
        <div className="pointer-events-none fixed inset-x-0 top-[112px] z-40 hidden lg:block">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-20">
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
              <div className="anim-pop-in pointer-events-auto flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-white/95 px-5 py-3 shadow-[0_12px_32px_-12px_rgba(10,25,47,0.25)] backdrop-blur-md">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-muted">
                    {software.logo ? (
                      <Image src={software.logo} alt="" fill className="object-contain p-1.5" sizes="36px" />
                    ) : (
                      <span className="text-xs font-black text-primary-navy/25">{software.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-primary-navy">{software.name}</p>
                    {rating > 0 && (
                      <div className="flex items-center gap-1.5">
                        <StarRow rating={rating} size={10} />
                        <span className="text-[11px] font-semibold text-text-muted">{rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => setDemoModalOpen(true)}>
                  Request demo
                </Button>
              </div>
              <div aria-hidden />
            </div>
          </div>
        </div>
      )}

      <Container className="pt-[120px] pb-28 lg:pt-[140px] lg:pb-10">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
          {/* Main column */}
          <div className="space-y-8 min-w-0">
            <Reveal>
              {/* Breadcrumb + meta */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold">
                  <Link
                    href="/#catalog"
                    className="inline-flex items-center gap-1.5 text-text-muted transition-colors hover:text-primary-navy"
                  >
                    <ArrowLeft size={13} />
                    Catalog
                  </Link>
                  {software.subcategory && (
                    <>
                      <span className="text-text-muted/30">/</span>
                      <Link
                        href={`/categories/${software.subcategory.category.slug}`}
                        className="text-text-muted transition-colors hover:text-primary-navy"
                      >
                        {software.subcategory.category.name}
                      </Link>
                      <span className="text-text-muted/30">/</span>
                      <Link
                        href={`/categories/${software.subcategory.category.slug}/${software.subcategory.slug}`}
                        className="text-text-muted transition-colors hover:text-primary-navy"
                      >
                        {software.subcategory.name}
                      </Link>
                    </>
                  )}
                  <span className="text-text-muted/30">/</span>
                  <span className="text-primary-navy">{software.name}</span>
                </nav>
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted/60">
                  <Calendar size={11} />
                  <span>Added {formatDate(software.createdAt)}</span>
                  {software.updatedAt !== software.createdAt && (
                    <>
                      <span className="hidden h-3 w-px bg-border-subtle sm:inline" aria-hidden />
                      <span>Updated {formatDate(software.updatedAt)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Hero */}
              <div
                ref={heroRef}
                className="relative overflow-hidden rounded-3xl border border-border-subtle bg-white p-6 sm:p-8"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(10,25,47,0.05) 1px, transparent 0)",
                    backgroundSize: "20px 20px",
                  }}
                  aria-hidden
                />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-surface-muted ring-4 ring-surface-muted sm:h-20 sm:w-20">
                      {software.logo ? (
                        <Image
                          src={software.logo}
                          alt=""
                          fill
                          className="object-contain p-2.5"
                          sizes="80px"
                        />
                      ) : (
                        <span className="text-2xl font-black text-primary-navy/25">
                          {software.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-brand-green/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-green-dark">
                          {software.subcategory?.name || "Uncategorized"}
                        </span>
                        {software.vendorId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-navy-600">
                            <ShieldCheck size={11} />
                            Vendor verified
                          </span>
                        )}
                      </div>
                      <h1 className="mt-2 text-2xl font-black tracking-tight text-primary-navy sm:text-3xl">
                        {software.name}
                      </h1>
                      {rating > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StarRow rating={rating} />
                          <span className="text-sm font-bold text-primary-navy">{rating.toFixed(1)}</span>
                          {reviewCount > 0 && (
                            <span className="text-xs font-semibold text-text-muted">
                              ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                    <Button onClick={() => setDemoModalOpen(true)}>Request a demo</Button>
                    <Button variant="outline" onClick={() => setDemoModalOpen(true)}>
                      Get pricing
                    </Button>
                  </div>
                </div>

                {software.introduction?.trim() && (
                  <p className="relative mt-6 line-clamp-2 max-w-2xl border-t border-border-subtle pt-5 text-sm leading-relaxed text-text-muted">
                    {software.introduction}
                  </p>
                )}
              </div>
            </Reveal>

            {/* Demo request — mobile/tablet only, the sticky aside handles it on desktop */}
            <div className="lg:hidden">
              <DemoRequestForm id="demo-mobile" softwareId={software.id} softwareName={software.name} />
            </div>

            {/* Introduction */}
            <Reveal>
              <section id="introduction" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Overview" title="Introduction" icon={BookOpen} />
                {software.introduction?.trim() ? (
                  <ProseBlock text={software.introduction} />
                ) : (
                  <EmptyBlock icon={BookOpen} message="Introduction coming soon." />
                )}
              </section>
            </Reveal>

            {/* Verdict */}
            <Reveal>
              <section id="verdict" className="scroll-mt-24">
                <div className="relative overflow-hidden rounded-3xl bg-[#0c221a] p-6 text-white sm:p-8">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-10"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)",
                      backgroundSize: "24px 24px",
                    }}
                    aria-hidden
                  />
                  <div className="relative">
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/40">
                      <Zap size={11} className="text-brand-green-light" />
                      Editorial
                    </span>
                    <h2 className="mt-1.5 font-brand text-xl font-bold tracking-tight text-white sm:text-2xl">
                      Our verdict
                    </h2>
                    {software.ourVerdict?.trim() ? (
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 whitespace-pre-line">
                        {software.ourVerdict}
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-white/50">Verdict not published yet.</p>
                    )}
                  </div>
                </div>
              </section>
            </Reveal>

            {/* Takeaways */}
            <Reveal>
              <section id="takeaways" className="scroll-mt-24">
                <CompactSectionHeader subtitle="At a glance" title="Key takeaways" icon={CheckCircle} />
                {takeaways.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {takeaways.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-white p-4"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green-dark">
                          <CheckCircle size={12} />
                        </span>
                        <p className="text-sm leading-relaxed text-text-muted">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock icon={CheckCircle} message="No key takeaways listed yet." />
                )}
              </section>
            </Reveal>

            {/* Pros & cons */}
            <Reveal>
              <section id="pros-cons" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Trade-offs" title="Pros & cons" icon={ArrowDownUp} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                        <CheckCircle size={15} />
                        Pros
                      </div>
                      {pros.length > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          {pros.length}
                        </span>
                      )}
                    </div>
                    {pros.length > 0 ? (
                      <ul className="mt-3 space-y-2.5">
                        {pros.map((item, idx) => (
                          <li key={idx} className="flex gap-2.5 text-sm leading-relaxed text-zinc-700">
                            <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-emerald-700/50">No pros documented.</p>
                    )}
                  </div>
                  <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
                        <XCircle size={15} />
                        Cons
                      </div>
                      {cons.length > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                          {cons.length}
                        </span>
                      )}
                    </div>
                    {cons.length > 0 ? (
                      <ul className="mt-3 space-y-2.5">
                        {cons.map((item, idx) => (
                          <li key={idx} className="flex gap-2.5 text-sm leading-relaxed text-zinc-700">
                            <XCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-rose-700/50">No cons documented.</p>
                    )}
                  </div>
                </div>
              </section>
            </Reveal>

            {/* Gallery */}
            <Reveal>
              <section id="gallery" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Screens" title="Gallery" icon={ImageIcon} />
                {pictures.length > 0 ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="group relative block aspect-video w-full overflow-hidden rounded-3xl border border-border-subtle bg-surface-muted"
                    >
                      <Image
                        src={pictures[activeImage]}
                        alt={`${software.name} screenshot ${activeImage + 1}`}
                        fill
                        className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                        sizes="(max-width: 768px) 100vw, 60vw"
                      />
                      {pictures.length > 1 && (
                        <span className="absolute bottom-3 right-3 rounded-full bg-primary-navy/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                          {activeImage + 1} / {pictures.length}
                        </span>
                      )}
                    </button>
                    {pictures.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {pictures.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImage(idx)}
                            className={`relative aspect-video overflow-hidden rounded-xl ring-2 transition-all ${
                              activeImage === idx ? "ring-brand-green" : "ring-transparent hover:ring-border-subtle"
                            }`}
                          >
                            <Image src={src} alt="" fill className="object-cover" sizes="120px" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyBlock icon={ImageIcon} message="No gallery images uploaded yet." />
                )}
              </section>
            </Reveal>

            {/* Deep dive */}
            <Reveal>
              <section id="deep-dive" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Details" title="Deep dive" icon={Layers} />
                {deepDive.length > 0 ? (
                  <div>
                    <div className="flex flex-wrap gap-1.5 rounded-full bg-surface-sunken p-1.5">
                      {deepDive.map((block) => {
                        const Icon = deepDiveIcons[block.id] ?? Lightbulb;
                        const active = (activeDeepDiveBlock?.id ?? deepDive[0].id) === block.id;
                        return (
                          <button
                            key={block.id}
                            type="button"
                            onClick={() => setActiveDeepDiveId(block.id)}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                              active ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
                            }`}
                          >
                            <Icon size={13} />
                            {block.title}
                          </button>
                        );
                      })}
                    </div>
                    {activeDeepDiveBlock && (
                      <div
                        key={activeDeepDiveBlock.id}
                        className="anim-fade-in mt-4 rounded-3xl border border-border-subtle bg-white p-6"
                      >
                        <ProseBlock text={activeDeepDiveBlock.body!} />
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyBlock icon={Layers} message="Deep dive details coming soon." />
                )}
              </section>
            </Reveal>

            {/* Market sentiment */}
            <Reveal>
              <section id="sentiments" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Buyer signal" title="Market sentiment" icon={TrendingUp} />
                {validSentiments.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {validSentiments.map((row, idx) => {
                      const tone = (row.sentiment || "").toLowerCase();
                      const barColor =
                        tone === "positive"
                          ? "bg-emerald-400"
                          : tone === "negative"
                          ? "bg-red-400"
                          : tone === "mixed"
                          ? "bg-amber-400"
                          : "bg-zinc-300";
                      return (
                        <div key={idx} className="overflow-hidden rounded-3xl border border-border-subtle bg-white">
                          <div className={`h-1 ${barColor}`} aria-hidden />
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="font-brand text-sm font-bold text-primary-navy">{row.theme}</h3>
                              <SentimentPill value={row.sentiment || "Neutral"} />
                            </div>
                            <div
                              className="mt-2 text-sm leading-relaxed text-text-muted [&_table]:my-2 [&_table]:w-full [&_td]:p-1.5"
                              dangerouslySetInnerHTML={{ __html: row.summary?.trim() || "—" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyBlock icon={TrendingUp} message="No sentiment breakdown published yet." />
                )}
              </section>
            </Reveal>

            {/* Specifications */}
            <Reveal>
              <section id="specifications" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Tech sheet" title="Specifications" icon={Settings} />
                {specEntries.length > 0 ? (
                  <dl className="grid gap-px overflow-hidden rounded-3xl border border-border-subtle bg-border-subtle sm:grid-cols-2">
                    {specEntries.map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-4 bg-white px-5 py-3.5">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted/80">
                          {key}
                        </dt>
                        <dd className="text-right text-sm font-bold text-primary-navy">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <EmptyBlock icon={Settings} message="Specifications coming soon." />
                )}
              </section>
            </Reveal>

            {/* FAQs */}
            <Reveal>
              <section id="faqs" className="scroll-mt-24">
                <CompactSectionHeader subtitle="Questions" title="FAQs" icon={Info} />
                {validFaqs.length > 0 ? (
                  <div className="divide-y divide-border-subtle overflow-hidden rounded-3xl border border-border-subtle bg-white">
                    {validFaqs.map((faq, idx) => (
                      <div key={idx}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFaqs((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60"
                        >
                          <span className="text-sm font-bold text-primary-navy">{faq.question}</span>
                          <ChevronDown
                            size={16}
                            className={`shrink-0 text-text-muted transition-transform ${
                              expandedFaqs[idx] ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {expandedFaqs[idx] && faq.answer?.trim() && (
                          <div className="anim-fade-in px-5 pb-4">
                            <p className="text-sm leading-relaxed text-text-muted whitespace-pre-line">
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock icon={Info} message="No FAQs published yet." />
                )}
              </section>
            </Reveal>

            <Reveal>
              <SoftwareReviews slug={software.slug} />
            </Reveal>
          </div>

          {/* Demo form + sticky section index — desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <DemoRequestForm id="demo-desktop" softwareId={software.id} softwareName={software.name} />

              <nav className="overflow-hidden rounded-3xl border border-border-subtle bg-white p-2" aria-label="On this page">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted/70">
                  On this page
                </p>
                <ul className="mt-1 space-y-0.5">
                  {sections.map((s) => {
                    const active = activeSection === s.id;
                    const Icon = s.icon;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                            active
                              ? "bg-brand-green/10 text-brand-green-dark"
                              : "text-text-muted hover:bg-surface-muted hover:text-primary-navy"
                          }`}
                        >
                          <Icon size={14} className="shrink-0" />
                          {s.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>
        </div>
      </Container>

      {/* Sticky demo CTA — mobile/tablet only */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary-navy">{software.name}</p>
            {rating > 0 && (
              <p className="text-xs text-text-muted">★ {rating.toFixed(1)}</p>
            )}
          </div>
          <Button size="sm" className="shrink-0" onClick={scrollToDemo}>
            Request demo
          </Button>
        </div>
      </div>

      {/* Demo / pricing request modal — triggered from either hero CTA */}
      {demoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="anim-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-primary-navy/90 p-4 backdrop-blur-sm"
          onClick={() => setDemoModalOpen(false)}
        >
          <div className="anim-zoom-in relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setDemoModalOpen(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-navy shadow-md transition-colors hover:bg-surface-muted"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <DemoRequestForm softwareId={software.id} softwareName={software.name} />
          </div>
        </div>
      )}

      {/* Gallery lightbox */}
      {lightboxOpen && pictures.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="anim-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-primary-navy/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-5 top-5 text-white/70 transition-colors hover:text-white"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          {pictures.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImage((i) => (i - 1 + pictures.length) % pictures.length);
              }}
              className="absolute left-4 text-white/70 transition-colors hover:text-white sm:left-8"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
          )}
          <Image
            src={pictures[activeImage]}
            alt=""
            width={1920}
            height={1080}
            className="anim-zoom-in max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {pictures.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImage((i) => (i + 1) % pictures.length);
              }}
              className="absolute right-4 text-white/70 transition-colors hover:text-white sm:right-8"
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}

      <Footer />
    </main>
  );
}

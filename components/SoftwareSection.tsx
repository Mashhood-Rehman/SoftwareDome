"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Settings,
  CircleUser,
} from "@/components/icons.js";

const TABS = [
  { label: "LMS Software", icon: GraduationCap, match: "lms" },
  { label: "EMR Software", icon: HeartPulse, match: "emr" },
  { label: "Project Management", icon: Lightbulb, match: "project" },
  { label: "CRM Software", icon: Settings, match: "crm" },
  { label: "Human Resources", icon: CircleUser, match: "hr" },
] as const;

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div
      className="flex items-center"
      style={{ gap: "2.29px", paddingTop: "9.15px" }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={16}
          className={
            i <= filled
              ? "fill-[#FF8903] text-[#FF8903]"
              : "fill-[#E2E8F0] text-[#E2E8F0]"
          }
        />
      ))}
    </div>
  );
}

function SoftwareCard({ software }: { software: any }) {
  return (
    <Link
      href={`/softwares/${software.slug}`}
      className="flex flex-col items-center hover:shadow-lg transition-shadow duration-200"
      style={{
        padding: "22.875px",
        background: "#FAFFF5",
        border: "1.14375px solid #F4F9FF",
        borderRadius: "18.3px",
        textDecoration: "none",
      }}
    >
      {/* Logo circle */}
      <div style={{ paddingBottom: "18.3px" }}>
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            width: "73.2px",
            height: "73.2px",
            background: "#F8FAFC",
            border: "1.14375px solid #F1F5F9",
            borderRadius: "9999px",
          }}
        >
          {software.logo ? (
            <img
              src={software.logo}
              alt=""
              style={{ width: "48px", height: "48px", objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                fontFamily: "var(--font-sora), Sora, sans-serif",
                fontWeight: 700,
                fontSize: "22px",
                color: "#0A192F",
              }}
            >
              {software.name?.[0] ?? "?"}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <span
        style={{
          fontFamily: "var(--font-sora), Sora, sans-serif",
          fontWeight: 600,
          fontSize: "16px",
          lineHeight: "23px",
          letterSpacing: "-0.160125px",
          color: "#0A192F",
          textAlign: "center",
        }}
      >
        {software.name}
      </span>

      {/* Stars */}
      <StarRating rating={software.rating ?? 0} />
    </Link>
  );
}

// ─── Card grid row ────────────────────────────────────────────────────────────
function CardRow({ items }: { items: any[] }) {
  if (!items.length) return null;
  return (
    <div
      className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      style={{ gap: "23px" }}
    >
      {items.map((sw) => (
        <SoftwareCard key={sw.id} software={sw} />
      ))}
    </div>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function AllProductsButton() {
  const arrowPath = "M1 4H11M8 1L11 4L8 7";
  const arrowStyle = {
    stroke: "#1D1D1D",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <div
      style={{
        width: "229px",
        height: "61px",
        background: "rgba(176, 255, 159, 0.2)",
        borderRadius: "100px",
        padding: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Link
        href="/categories"
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: "217px",
          height: "49px",
          background: "linear-gradient(180deg, #B0FE5E 0%, #5BA40D 100%)",
          boxShadow:
            "0px 5px 23px rgba(214, 253, 112, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.3), inset 4px 4px 8px rgba(255, 255, 255, 0.3)",
          borderRadius: "100px",
          padding: "12px 54px 12px 30px",
          isolation: "isolate",
          textDecoration: "none",
          gap: "10px",
        }}
      >
        {/* Decorative left circle (clipped by overflow:hidden) */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: "32px",
            height: "32px",
            left: "-47.71px",
            top: "1.87px",
            background: "#FFFFFF",
            borderRadius: "100px",
            transform: "rotate(-45deg)",
            zIndex: 0,
          }}
        >
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            aria-hidden
            style={{ transform: "rotate(-45deg)" }}
          >
            <path d={arrowPath} {...arrowStyle} />
          </svg>
        </div>

        {/* Label */}
        <span
          style={{
            fontFamily: "var(--font-sora), Sora, sans-serif",
            fontWeight: 600,
            fontSize: "16px",
            lineHeight: "23px",
            color: "#FFFFFF",
            whiteSpace: "nowrap",
            position: "relative",
            zIndex: 0,
          }}
        >
          All products
        </span>

        {/* Right arrow circle */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: "32px",
            height: "32px",
            left: "176.08px",
            top: "8.5px",
            background: "#FFFFFF",
            borderRadius: "100px",
            zIndex: 2,
          }}
        >
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
            <path d={arrowPath} {...arrowStyle} />
          </svg>
        </div>
      </Link>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function SoftwareSection({
  initialData,
}: {
  initialData?: any[];
}) {
  const softwares = initialData ?? [];

  // Default to whichever tab has data, fallback to index 1 (EMR)
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = TABS.findIndex((tab) =>
      softwares.some((s: any) =>
        s.subcategory?.category?.name?.toLowerCase().includes(tab.match),
      ),
    );
    return idx > -1 ? idx : 1;
  });

  // Filter by tab, then show highest-rated first, and slice to max 10 items
  const filtered = useMemo(
    () =>
      softwares
        .filter((s: any) =>
          s.subcategory?.category?.name
            ?.toLowerCase()
            .includes(TABS[activeIndex].match),
        )
        .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10),
    [softwares, activeIndex],
  );

  const row1 = filtered.slice(0, 5);
  const row2 = filtered.slice(5, 10);

  return (
    <section
      id="catalog"
      className="bg-white w-full scroll-mt-20 py-6 md:py-12 lg:py-20"
    >
      <div
        className="flex flex-col items-center mx-auto px-5 xl:px-[80px]"
        style={{ maxWidth: "1441.5px", gap: "30px" }}
      >
        {/* Heading */}
        <div className="flex flex-col items-center" style={{ gap: "24px" }}>
          <h2
            style={{
              fontFamily:
                'var(--font-jakarta), "Plus Jakarta Sans", sans-serif',
              fontWeight: 700,
              fontSize: "clamp(28px, 3.2vw, 46px)",
              lineHeight: "1.0",
              letterSpacing: "-0.54px",
              color: "#0A192F",
              textAlign: "center",
            }}
          >
            Choose from 1000+ software options
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sora), Sora, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(14px, 1.4vw, 20px)",
              lineHeight: "20px",
              color: "#71717B",
              textAlign: "center",
            }}
          >
            Here are our top picks from our most popular categories
          </p>
        </div>

        {/* Tab bar + cards */}
        <div
          className="flex flex-col items-center w-full"
          style={{ maxWidth: "1281.5px", gap: "26px" }}
        >
          {/* Tab bar */}
          <div
            className="flex flex-row items-center w-full overflow-x-auto no-scrollbar md:justify-center"
            style={{
              gap: "10px",
              borderBottom: "1px solid #F2F2F2",
              height: "41px",
            }}
          >
            {TABS.map((tab, i) => {
              const isActive = i === activeIndex;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.match}
                  onClick={() => setActiveIndex(i)}
                  className="flex items-center flex-shrink-0 h-full transition-colors duration-150"
                  style={{
                    gap: "8px",
                    padding: "0 16px",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid #2F6C25"
                      : "2px solid transparent",
                    marginBottom: "-1px",
                    borderRadius: 0,
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sora), Sora, sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    lineHeight: "20px",
                    color: isActive ? "#2F6C25" : "#5B6B63",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Card rows */}
          <div className="flex flex-col w-full" style={{ gap: "25px" }}>
            <CardRow items={row1} />
            <CardRow items={row2} />

            {/* Empty state */}
            {filtered.length === 0 && (
              <div
                className="flex items-center justify-center w-full"
                style={{
                  border: "1.5px dashed #E2E8F0",
                  background: "#FAFFF5",
                  borderRadius: "18.3px",
                  padding: "48px 24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sora), Sora, sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "#0A192F",
                  }}
                >
                  More {TABS[activeIndex].label} listings coming soon
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <AllProductsButton />
      </div>
    </section>
  );
}

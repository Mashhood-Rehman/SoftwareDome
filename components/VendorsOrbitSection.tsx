"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Dims {
  sectionHeight: number;
  hillsHeight: number;
  radius: number;
  centerY: number;
  contentTop: number;
  iconSize: number;
  showIcons: boolean;
}

function getDims(w: number): Dims {
  if (w < 640) {
    return {
      sectionHeight: 460,
      hillsHeight: 170,
      radius: 0,
      centerY: 0,
      contentTop: 28,
      iconSize: 0,
      showIcons: false,
    };
  }
  const sectionHeight = w < 768 ? 520 : w < 1024 ? 600 : 700;
  const hillsHeight = w < 768 ? 200 : w < 1024 ? 240 : 290;
  // radius proportional to section width, capped at the Figma desktop value (316)
  const radius = Math.round(Math.min(w * 0.245, 316));
  // orbit center Y = radius + 26px top clearance (matches desktop: 316+26=342)
  const centerY = radius + 26;
  return {
    sectionHeight,
    hillsHeight,
    radius,
    centerY,
    contentTop: centerY - 65, // 65 = half of desktop logo height (130px)
    iconSize: w < 768 ? 64 : w < 1024 ? 70 : 80,
    showIcons: true,
  };
}

function computePositions(r: number, cY: number, hY: number) {
  return Array.from({ length: 9 }, (_, i) => {
    const deg = 250 + i * 27.5;
    const rad = (deg * Math.PI) / 180;
    const x = r * Math.sin(rad);
    const y = r * -Math.cos(rad);
    return { x, y, z: cY + y > hY ? 0 : 2 };
  });
}

export default function VendorsOrbitSection({
  initialData,
}: {
  initialData?: any[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Default to desktop so SSR HTML matches the most common viewport
  const [dims, setDims] = useState<Dims>(() => getDims(1280));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims(getDims(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const {
    sectionHeight,
    hillsHeight,
    radius,
    centerY,
    contentTop,
    iconSize,
    showIcons,
  } = dims;
  const hillsY = sectionHeight - hillsHeight;
  const positions = showIcons ? computePositions(radius, centerY, hillsY) : [];
  const rated = (initialData ?? [])
    .filter((sw) => (sw?.rating ?? 0) > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const unrated = (initialData ?? []).filter((sw) => !((sw?.rating ?? 0) > 0));
  const softwares = [...rated, ...unrated].slice(0, positions.length);

  const logoSize = showIcons ? 130 : 90;
  const contentGap = showIcons ? 30 : 16;
  const headingSize = showIcons ? 28 : 22;
  const headingLineH = showIcons ? 34 : 28;

  return (
    <div ref={wrapRef} style={{ padding: "0 10px", background: "#FFFFFF" }}>
      <section
        className="relative w-full overflow-hidden"
        style={{
          background: "#F7FFEF",
          borderRadius: "30px",
          height: `${sectionHeight}px`,
        }}
      >
        {/* ── Floating software icon circles ── */}
        {positions.map((pos, i) => {
          const sw = softwares[i];
          const imgSize = Math.round(iconSize * 0.6);
          return (
            <div
              key={i}
              className="absolute flex items-center justify-center overflow-hidden"
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `${centerY + pos.y}px`,
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                background: "#FFFFFF",
                borderRadius: "50%",
                transform: "translate(-50%, 100%)",
                boxShadow:
                  "0px 4px 16px rgba(0,0,0,0.08), 0px 0px 0px 1px rgba(0,0,0,0.04)",
                zIndex: pos.z,
              }}
            >
              {sw?.logo ? (
                <img
                  src={sw.logo}
                  alt={sw.name ?? ""}
                  style={{
                    width: `${imgSize}px`,
                    height: `${imgSize}px`,
                    objectFit: "contain",
                    borderRadius: "50%",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--font-sora), Sora, sans-serif",
                    fontWeight: 700,
                    fontSize: `${Math.round(iconSize * 0.3)}px`,
                    color: "#0A192F",
                  }}
                >
                  {sw?.name?.[0] ?? "?"}
                </span>
              )}
            </div>
          );
        })}

        {/* ── Center content ── */}
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: "50%",
            top: `${contentTop}px`,
            transform: "translateX(-50%)",
            gap: `${contentGap}px`,
            zIndex: 3,
            width: "min(493px, calc(100% - 32px))",
          }}
        >
          {/* SoftwareDome logo circle */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: `${logoSize}px`,
              height: `${logoSize}px`,
              background: "#072929",
              borderRadius: "50%",
              boxShadow:
                "inset -1.49px -1.49px 2.98px rgba(255,255,255,0.3), inset 1.49px 1.49px 2.98px rgba(255,255,255,0.3), 0px 2.98px 5.96px rgba(29,29,29,0.5)",
            }}
          >
            <img
              src="/logomark.svg"
              alt="SoftwareDome"
              style={{
                width: `${Math.round(logoSize * 0.538)}px`,
                height: `${Math.round(logoSize * 0.538)}px`,
                objectFit: "contain",
                transform: "translateY(1.5px)",
              }}
            />
          </div>

          {/* Heading */}
          <h2
            style={{
              fontFamily:
                'var(--font-jakarta), "Plus Jakarta Sans", sans-serif',
              fontWeight: 600,
              fontSize: `${headingSize}px`,
              lineHeight: `${headingLineH}px`,
              letterSpacing: "-1px",
              color: "#1D1D1D",
              textAlign: "center",
              maxWidth: "296px",
              margin: 0,
            }}
          >
            Explore all of our vendors
          </h2>

          {/* CTA pill */}
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
              flexShrink: 0,
            }}
          >
            <Link
              href="/categories"
              className="relative flex flex-row items-center justify-center overflow-hidden"
              style={{
                width: "217px",
                height: "49px",
                background: "linear-gradient(180deg, #B0FE5E 0%, #5BA40D 100%)",
                boxShadow:
                  "0px 5px 23px rgba(214,253,112,0.3), inset -4px -4px 8px rgba(255,255,255,0.3), inset 4px 4px 8px rgba(255,255,255,0.3)",
                borderRadius: "100px",
                padding: "12px 54px 12px 30px",
                isolation: "isolate",
                textDecoration: "none",
                gap: "10px",
              }}
            >
              {/* Decorative left circle */}
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
                  <path
                    d="M1 4H11M8 1L11 4L8 7"
                    stroke="#1D1D1D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

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
                Explore all
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
                <svg
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M1 4H11M8 1L11 4L8 7"
                    stroke="#1D1D1D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Hills / grass image — anchored to bottom ── */}
        <img
          src="/hills-bg.png"
          alt=""
          aria-hidden
          className="absolute bottom-0 left-0 w-full pointer-events-none"
          style={{
            height: `${hillsHeight}px`,
            objectFit: "cover",
            objectPosition: "top",
            zIndex: 1,
          }}
        />
      </section>
    </div>
  );
}

import HeroSearch from "@/components/HeroSearch";
import NavWrapper from "@/components/NavWrapper";
import Image from "next/image";
import {
  pickFloatingCards,
  type SoftwareForCard,
} from "@/lib/hero-floating-cards";

const trustedLogos = [
  { name: "Paychex", src: "/vendors/paychex.avif", w: 96 },
  { name: "ADP", src: "/vendors/adp.avif", w: 96 },
  { name: "athenahealth", src: "/vendors/athenahealth.avif", w: 96 },
  { name: "RXNT", src: "/vendors/rxnt.avif", w: 96 },
  { name: "HubSpot", src: "/vendors/hubspot.avif", w: 96 },
  { name: "UKG", src: "/vendors/ukg.avif", w: 96 },
  { name: "Absorb LMS", src: "/vendors/absorb.avif", w: 96 },
  { name: "isolved", src: "/vendors/isolved.avif", w: 96 },
  { name: "monday.com", src: "/vendors/monday.avif", w: 96 },
  { name: "Houzz Pro", src: "/vendors/houzz.avif", w: 80 },
  { name: "ModMed", src: "/vendors/modmed.avif", w: 96 },
  { name: "Epicor", src: "/vendors/epicor.avif", w: 96 },
];

export default function Hero({ softwares }: { softwares?: SoftwareForCard[] }) {
  return (
    <div className="">
      <section className="relative bg-gradient-to-b from-[#A7FF4AA3] to-[#F7FFEF99] flex flex-col overflow-hidden lg:min-h-dvh">
        {/* Navbar lives inside the hero section */}
        <NavWrapper />

        {/* Floating decorative cards — absolute, visible at every breakpoint, scaled down on small screens.
            Sourced from top-rated software and re-picked on each ISR regeneration (~every 10 min). */}
        {pickFloatingCards(softwares).map((card, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute hidden items-center justify-center bg-white sm:flex sm:w-9 sm:h-9 md:w-12 md:h-12 lg:w-10 lg:h-12 xl:w-14 xl:h-14"
            style={{
              left: card.left,
              top: card.top,
              borderRadius: "16px",
              boxShadow:
                "0px 0px 0px 1px rgba(255, 255, 255, 0.2), 0px 25px 50px -10px rgba(0, 0, 0, 0.15)",
              transform: `rotate(${card.rotate})`,
            }}
          >
            <Image
              src={card.src}
              alt={card.alt}
              width={100}
              height={100}
              unoptimized={card.src.endsWith(".svg")}
              className="object-contain w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12"
            />
          </div>
        ))}

        <div className="flex flex-col items-center justify-center gap-4 px-4 pt-[120px] pb-14 md:pt-[130px] md:pb-16 lg:pt-[95px] lg:pb-10 lg:flex-1 xl:pb-[50px] text-center">
          <h1
            className="font-bold tracking-tight"
            style={{
              fontFamily:
                "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
              fontSize: "clamp(36px, 5.5vw, 65px)",
              lineHeight: "1.1",
              letterSpacing: "-1.2px",
            }}
          >
            Find the right <span className="text-[#5FC24A]">software</span>
            <br />
            from 1000s of vendors
          </h1>

          {/* Sub-headline */}
          <p
            className="max-w-lg w-full"
            style={{
              fontFamily: "var(--font-sora), Sora, sans-serif",
              fontSize: "clamp(15px, 1.5vw, 20px)",
              fontWeight: 400,
              lineHeight: "1.5",
              color: "#2F6C25",
            }}
          >
            Compare unbiased reviews, pricing, and expert advice, all under one
            dome.
          </p>

          {/* Search bar */}
          <HeroSearch />
        </div>

        {/* ── Trusted by Top Vendors strip ─────────────────────────────── */}
        <div className="flex justify-center pb-8">
          <span
            className="font-bold uppercase leading-4"
            style={{
              color: "#878787",
              fontSize: "20px",
              letterSpacing: "0.08em",
            }}
          >
            Trusted by Top Vendors
          </span>
        </div>

        {/* Marquee */}
        <div className="overflow-hidden pb-8">
          <div className="marquee-track" style={{ animationDuration: "30s" }}>
            {[
              ...trustedLogos,
              ...trustedLogos,
              ...trustedLogos,
              ...trustedLogos,
              ...trustedLogos,
              ...trustedLogos,
            ].map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: "144px", height: "32px" }}
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.w}
                  height={32}
                  loading="lazy"
                  className="object-contain"
                  style={{ width: `${logo.w}px`, height: "32px", opacity: 0.7 }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowTrendingUpIcon, ChevronLeftIcon, ChevronRightIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import MapboxMap from "@/components/MapboxMap";
import { API_BASE_URL, BOROUGHS_GEOJSON_URL } from "@/lib/config";

interface CatSighting {
  id: number;
  lat: number;
  lng: number;
  cat_name?: string;
  description: string;
  address?: string;
  image_url?: string;
  created_at: string;
}

type BoroughFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { boroname: string }>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "JUST NOW";
  if (mins < 60) return `${mins} MIN AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return n.toString();
}

const BOROUGHS = ["Brooklyn", "Manhattan", "Queens", "Bronx", "Staten Island"] as const;

function pointInRing(px: number, py: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInBorough(lng: number, lat: number, feature: BoroughFeature): boolean {
  const { geometry } = feature;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.coordinates;
  return polygons.some(([outerRing]) => pointInRing(lng, lat, outerRing));
}

export default function Home() {
  const [sightings, setSightings] = useState<CatSighting[]>([]);
  const [boroughFeatures, setBoroughFeatures] = useState<BoroughFeature[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cats`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSightings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(BOROUGHS_GEOJSON_URL)
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection) => {
        setBoroughFeatures(fc.features as BoroughFeature[]);
      })
      .catch(() => {});
  }, []);

  const latest = sightings[0] ?? null;

  const boroughCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of BOROUGHS) counts[b] = 0;
    if (boroughFeatures.length === 0) return counts;
    for (const s of sightings) {
      const feature = boroughFeatures.find((f) => pointInBorough(s.lng, s.lat, f));
      const name = feature?.properties?.boroname;
      if (name && name in counts) counts[name]++;
    }
    return counts;
  }, [sightings, boroughFeatures]);

  const lastDayCount = useMemo(() => {
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    return sightings.filter((s) => new Date(s.created_at).getTime() >= oneDayAgoMs).length;
  }, [sightings]);

  const maxBoroughCount = useMemo(() => {
    return Math.max(...Object.values(boroughCounts), 1);
  }, [boroughCounts]);

  // Carousel: image-bearing sightings first, then the rest, capped at 12
  const carouselSightings = useMemo(() => {
    const withImg = sightings.filter((s) => s.image_url);
    const without = sightings.filter((s) => !s.image_url);
    return [...withImg, ...without].slice(0, 12);
  }, [sightings]);

  // Ghost copies on both ends for seamless infinite scroll in both directions
  const GHOST_COUNT = 3;
  const trackItems = [
    ...carouselSightings.slice(-GHOST_COUNT),
    ...carouselSightings,
    ...carouselSightings.slice(0, GHOST_COUNT),
  ];

  // Start at GHOST_COUNT so the first real item is visible
  const [carouselIndex, setCarouselIndex] = useState(GHOST_COUNT);
  const [carouselAnimating, setCarouselAnimating] = useState(true);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);

  // Measure container width → derive card width (3 cards + 2 gaps of 16px).
  // Depends on carouselSightings.length so it re-runs once the carousel
  // renders for the first time (containerRef goes from null → element).
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setCardWidth((containerRef.current.getBoundingClientRect().width - 32) / 3);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [carouselSightings.length]);

  // Auto-advance every 5s
  useEffect(() => {
    if (carouselPaused || carouselSightings.length < 2) return;
    const id = setInterval(() => {
      setCarouselIndex((i) => i + 1);
    }, 5000);
    return () => clearInterval(id);
  }, [carouselPaused, carouselSightings.length]);

  // Only handle the transform transition on the track itself — child elements
  // (card hover animations) also bubble transitionend up and would corrupt state.
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    const realLen = carouselSightings.length;
    if (carouselIndex >= GHOST_COUNT + realLen) {
      setCarouselAnimating(false);
      setCarouselIndex(carouselIndex - realLen);
      // Double-RAF: first frame commits the snap (transition:none + new position),
      // second frame re-enables the transition so the next slide animates.
      requestAnimationFrame(() => requestAnimationFrame(() => setCarouselAnimating(true)));
    } else if (carouselIndex < GHOST_COUNT) {
      setCarouselAnimating(false);
      setCarouselIndex(carouselIndex + realLen);
      requestAnimationFrame(() => requestAnimationFrame(() => setCarouselAnimating(true)));
    }
  };

  const handleNext = () => {
    setCarouselIndex((i) => i + 1);
  };

  const handlePrev = () => {
    setCarouselIndex((i) => i - 1);
  };

  const step = cardWidth + 16; // card width + gap-4
  const trackTranslate = -(carouselIndex * step);

  return (
    <main className="bg-cream-100 text-stone-900">
      {/* Banner strip */}
      <div
        className="text-[10px] tracking-[0.18em] uppercase flex items-center justify-between px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-1.5"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <span className="text-white/60">New York City · All Five Boroughs</span>
        <span className="flex items-center gap-2 text-white/90 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-lilac-400 animate-pulse" />
          Live Tracking
        </span>
      </div>

      {/* Hero — full-height split */}
      <section
        className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.85fr_1.15fr]"
        style={{ minHeight: "calc(82vh - 3rem)" }}
      >

        {/* Left: editorial content */}
        <div className="flex flex-col pl-8 sm:pl-16 lg:pl-32 xl:pl-40 2xl:pl-48 pr-2 sm:pr-4 lg:pr-8 xl:pr-10 2xl:pr-12 py-8 lg:py-10 border-r border-lilac-100">
          <div className="space-y-5">
            <p className="interactive-map-tag group w-fit inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-lilac-600 font-medium">
              <MapIcon className="map-icon-bounce h-3.5 w-3.5" />
              <span className="hover-word">Mapping the strays of New York</span>
            </p>

            <h1 className="text-[3.6rem] sm:text-[4.5rem] lg:text-[5.4rem] font-bold leading-[0.9] tracking-[0.02em]">
              <span className="block">
                <span className="hover-word">EVERY</span>
              </span>
              <span className="block text-lilac-700">
                <span className="hover-word">CAT,</span>
              </span>
              <span className="block">
                <span className="hover-word">EVERY</span>{" "}
                <span className="hover-word">CORNER.</span>
              </span>
            </h1>

            <div className="w-10 h-0.5 bg-lilac-700" />

            <p className="text-sm text-stone-500 max-w-none italic leading-relaxed">
              A data-driven map dedicated to helping every stray find safety, care, and love — giving a voice to the cats that call New York home.
            </p>
          </div>

          {/* Bottom: CTAs + stats */}
          <div className="mt-8 space-y-5">
            {/* CTA row */}
            <div className="flex gap-10">
              <Link
                to="/sightings"
                className="text-sm tracking-[0.2em] uppercase font-bold text-stone-500 hover:text-stone-900 transition leading-snug animated-link"
              >
                <span className="hover-word">Browse</span><br />
                <span className="hover-word">Sightings</span>
                <span className="link-arrow">↗</span>
              </Link>
              <Link
                to="/map"
                className="text-sm tracking-[0.2em] uppercase font-bold text-stone-500 hover:text-stone-900 transition leading-snug animated-link"
              >
                <span className="hover-word">Report</span><br />
                <span className="hover-word">a Cat</span>
                <span className="link-arrow">↗</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="h-px bg-stone-200" />

            {/* Stats row */}
            <div className="flex gap-0">
              <div className="group pr-10 border-r border-stone-200">
                <div className="flex items-start gap-2">
                  <div className="text-4xl font-bold text-lilac-700 leading-none transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
                    {formatCount(sightings.length)}
                  </div>
                  <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500 opacity-0 transition-all duration-200 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0" />
                </div>
                <div className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mt-2">Total Sightings</div>
                <div className="text-sm text-emerald-600 mt-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {lastDayCount} reported in last 24h
                </div>
              </div>
              <div className="group pl-10">
                <div className="flex items-start gap-2">
                  <div className="text-4xl font-bold text-lilac-700 leading-none transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
                    {Math.max(sightings.length - 1, 0)}
                  </div>
                  <MapPinIcon className="h-5 w-5 text-lilac-500 opacity-0 transition-all duration-200 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0" />
                </div>
                <div className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mt-2">Active Cases</div>
                <div className="text-sm text-lilac-700 mt-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Being tracked
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: live map */}
        <div className="bg-cream-100 pl-4 lg:pl-12 xl:pl-16 2xl:pl-24 pr-8 sm:pr-16 lg:pr-32 xl:pr-40 2xl:pr-48 py-3 lg:py-5 flex items-stretch min-h-[62vw] lg:min-h-full">
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-lilac-200 shadow-soft">
            <MapboxMap sightings={sightings} onMapClick={() => {}} />

            {/* Latest sighting card */}
            {latest && (
              <Link
                to={`/sightings/${latest.id}`}
                className="absolute top-4 right-4 bg-cream-50/95 backdrop-blur-sm border border-lilac-200 rounded-xl shadow-soft p-4 w-56 hover:border-lilac-400 transition"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-lilac-500 animate-pulse flex-shrink-0" />
                  <span className="text-[9px] tracking-[0.2em] uppercase text-lilac-600 font-semibold">
                    {timeAgo(latest.created_at)}
                  </span>
                </div>
                <p className="font-semibold text-stone-900 text-sm leading-tight">
                  {latest.cat_name || "Unknown cat"}
                </p>
                {latest.address && (
                  <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">{latest.address}</p>
                )}
                {!latest.address && latest.description && (
                  <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">{latest.description}</p>
                )}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Borough strip */}
      <div className="border-t border-stone-300" style={{ backgroundColor: "#0f0f0f" }}>
        <div className="px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24">
          <div className="py-3 flex items-center justify-between border-b border-white/10">
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/50 font-medium">
              Sightings by Borough
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-white/30">
              {sightings.length} Total
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {BOROUGHS.map((borough) => {
              const count = boroughCounts[borough];
              const pct = (count / maxBoroughCount) * 100;
              const isEmpty = count === 0;
              const sharePct = sightings.length > 0 ? Math.round((count / sightings.length) * 100) : 0;

              return (
                <div
                  key={borough}
                  className="group relative px-4 sm:px-5 lg:px-7 xl:px-8 py-6 hover:bg-white/5 transition-colors cursor-default overflow-hidden"
                >
                  <div
                    className="absolute bottom-0 left-0 h-0.5 bg-lilac-500 group-hover:bg-lilac-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />

                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[9px] tracking-[0.25em] uppercase text-white/60 font-medium">
                      {borough}
                    </div>
                    {!isEmpty && (
                      <div className="text-[9px] tracking-[0.15em] uppercase text-lilac-400/70">
                        {sharePct}%
                      </div>
                    )}
                  </div>

                  <div className="flex items-end justify-between mt-3">
                    <div
                      className={`text-3xl font-bold leading-none transition-colors ${
                        isEmpty ? "text-white/20" : "text-lilac-400"
                      }`}
                    >
                      {isEmpty ? "00" : count.toString().padStart(2, "0")}
                    </div>
                    <div className="text-[9px] tracking-[0.2em] uppercase text-white/30 pb-0.5">
                      {isEmpty ? "No reports" : count === 1 ? "Sighting" : "Sightings"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent cats carousel */}
      {carouselSightings.length > 0 && (
        <div
          className="border-t border-stone-200 bg-cream-100 py-8"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          <div className="px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 mb-5 flex items-center justify-between">
            <div className="text-[10px] tracking-[0.25em] uppercase text-stone-500 font-medium">
              Recently Spotted
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                aria-label="Previous"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 bg-white text-stone-500 hover:border-lilac-400 hover:text-lilac-600 transition-colors shadow-sm"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                aria-label="Next"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 bg-white text-stone-500 hover:border-lilac-400 hover:text-lilac-600 transition-colors shadow-sm"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Clipping container */}
          <div
            ref={containerRef}
            className="overflow-hidden px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24"
          >
            {/* Sliding track */}
            <div
              className="flex gap-4"
              style={{
                transform: `translateX(${trackTranslate}px)`,
                transition: carouselAnimating ? "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {trackItems.map((s, i) => (
                <Link
                  key={`${s.id}-${i}`}
                  to={`/sightings/${s.id}`}
                  className="group flex-none rounded-2xl overflow-hidden border border-stone-200 hover:border-lilac-300 transition-colors duration-200 bg-white shadow-sm hover:shadow-md"
                  style={{ width: cardWidth || "calc(33.333% - 10.667px)" }}
                >
                  {/* Image */}
                  <div className="relative w-full bg-stone-100 overflow-hidden" style={{ height: cardWidth ? cardWidth * 0.72 : 200 }}>
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.cat_name || "Cat sighting"}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <img src="/paw.svg" alt="" className="w-14 h-14 opacity-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                      <p className="text-white font-semibold text-sm leading-tight drop-shadow">
                        {s.cat_name || "Unknown cat"}
                      </p>
                      <p className="text-white/70 text-[10px] tracking-[0.12em] uppercase mt-0.5">
                        {timeAgo(s.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Address */}
                  {s.address ? (
                    <div className="px-4 py-2.5">
                      <p className="text-[11px] text-stone-400 truncate">{s.address}</p>
                    </div>
                  ) : (
                    <div className="py-2.5" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

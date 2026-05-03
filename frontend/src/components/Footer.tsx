"use client";

import { Link } from "react-router-dom";

const NAV = [
  { label: "Map", href: "/map" },
  { label: "Sightings", href: "/sightings" },
  { label: "Report a Cat", href: "/map" },
];

const RESOURCES = [
  { label: "NYC Animal Care Centers", href: "https://www.nycacc.org", external: true },
  { label: "ASPCA NYC", href: "https://www.aspca.org/nyc", external: true },
  { label: "Neighborhood Cats (TNR)", href: "https://www.neighborhoodcats.org", external: true },
  { label: "NYC311 Animal Help", href: "https://portal.311.nyc.gov", external: true },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#0f0f0f" }} className="text-white/60">
      <div className="px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-lilac-700 grid place-items-center flex-shrink-0">
                <img src="/nyc-cat-logo.svg" alt="" className="h-5 w-5 object-contain" />
              </div>
              <span className="text-sm font-bold tracking-[0.14em] uppercase text-white">
                NYC Cat Tracker
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-white/40">
              A data-driven map dedicated to helping every stray find safety, care, and love — giving a voice to the cats that call New York home.
            </p>
            <p className="mt-6 text-[11px] tracking-[0.2em] uppercase text-white/25">
              New York City · All Five Boroughs
            </p>
          </div>

          {/* Navigate */}
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/30 font-medium mb-4">
              Navigate
            </p>
            <ul className="space-y-2.5">
              {NAV.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-white/50 hover:text-white transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/30 font-medium mb-4">
              Resources
            </p>
            <ul className="space-y-2.5">
              {RESOURCES.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/50 hover:text-white transition-colors duration-150"
                  >
                    {label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[11px] text-white/25">
            © {year} NYC Cat Tracker. Made with love for the strays of New York.
          </p>
          <p className="text-[11px] text-white/20 tracking-[0.15em] uppercase">
            Not affiliated with NYC gov
          </p>
        </div>
      </div>
    </footer>
  );
}

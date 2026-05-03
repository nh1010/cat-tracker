"use client";

import { Link } from "react-router-dom";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const navItems = [
  { name: "Map", href: "/map" },
  { name: "Sightings", href: "/sightings" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-lilac-200/70 bg-cream-100/95 backdrop-blur">
      <div className="px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 flex h-16 items-center justify-between">
        {/* Logo + Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-lilac-700 grid place-items-center overflow-hidden flex-shrink-0">
            <img src="/nyc-cat-logo.svg" alt="NYC Cat Tracker" className="h-5 w-5 object-contain" />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-[0.14em] uppercase text-stone-900 hover-word">
            NYC Cat Tracker
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-500 hover:text-stone-900 transition hover-word"
            >
              {item.name}
            </Link>
          ))}
          <Link
            to="/map"
            className="text-[11px] font-bold tracking-[0.14em] uppercase bg-lilac-700 text-white px-4 py-2 rounded-full hover:bg-lilac-800 transition animated-link"
          >
            Report a cat <span className="link-arrow">↗</span>
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-stone-500 hover:text-stone-900"
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-lilac-200/70 bg-cream-100/95">
          <div className="px-8 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setOpen(false)}
                className="block px-2 py-2 text-[11px] tracking-[0.18em] uppercase font-semibold text-stone-500 hover:text-stone-900 hover-word"
              >
                {item.name}
              </Link>
            ))}
            <Link
              to="/map"
              onClick={() => setOpen(false)}
              className="block mt-2 text-center text-[11px] tracking-[0.14em] uppercase font-bold bg-lilac-700 text-white px-4 py-2 rounded-full hover:bg-lilac-800 animated-link"
            >
              Report a cat <span className="link-arrow">↗</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

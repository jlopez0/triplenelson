"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Menu, X, Zap } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "// HOME", href: "/" },
  { name: "// GALLERY", href: "/fotos" },
  { name: "// FAQ", href: "/faqs" },
  { name: "// CONTACT", href: "/contacto" },
  { name: "TICKETS ->", href: "/aportar", highlight: true },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed w-full z-50 top-0 left-0 bg-black/80 backdrop-blur-md border-b border-white/10 h-20 flex items-center">
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="group flex flex-col items-start leading-none gap-0.5">
           <span className="font-display text-2xl tracking-tighter text-white group-hover:text-brand-acid transition-colors">TRIPLENELSON</span>
           <span className="font-mono text-[10px] tracking-[0.3em] text-white/50 group-hover:text-white transition-colors">EST. 2026 // RAVE</span>
        </Link>
        
        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center space-x-12">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "font-mono text-sm tracking-widest transition-all hover:text-brand-acid uppercase",
                item.highlight 
                  ? "bg-white text-black px-6 py-2 hover:bg-brand-acid hover:text-black font-bold" 
                  : pathname === item.href 
                    ? "text-brand-acid border-b border-brand-acid pb-1" 
                    : "text-white/60"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* MOBILE TOGGLE */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 text-white hover:text-brand-acid"
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

       {/* Mobile Menu */}
       {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-black border-b border-white/10 p-6 flex flex-col gap-6">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="font-display text-3xl text-white uppercase hover:text-brand-acid transition-colors border-l-2 border-transparent hover:border-brand-acid pl-4"
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

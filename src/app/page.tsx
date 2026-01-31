'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date('2026-06-20T23:59:59').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen bg-techno flex flex-col">
      
      {/* Hero Section - Balanced */}
      <section className="container-pro py-6 md:py-8 lg:py-10 flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 lg:gap-10 w-full">
          
          {/* Title */}
          <div className="lg:col-span-7 lg:order-1 order-1">
            <h1 className="font-display font-bold text-5xl md:text-7xl lg:text-8xl leading-none tracking-tighter">
              TRIPLE
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
                NELSON
              </span>
            </h1>
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent mt-4 md:mt-5 lg:hidden" />
          </div>

          {/* Countdown */}
          <div className="lg:col-span-5 lg:order-2 order-2">
            <div className="rounded-3xl border border-zinc-800/80 bg-black/40 backdrop-blur-sm p-5 md:p-6 lg:p-8">
              <div className="text-center mb-4 md:mb-5">
                <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-zinc-500 font-medium">
                  Cuenta Regresiva
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Días</div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Horas</div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Min</div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-black/30 backdrop-blur-sm p-4 md:p-5 text-center group hover:border-zinc-700 transition-all">
                  <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600 mt-2">Seg</div>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Buttons */}
          <div className="lg:col-span-7 lg:order-3 order-3 space-y-3 md:space-y-5 lg:space-y-6">
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent hidden lg:block" />
            
            <p className="text-sm md:text-lg lg:text-xl text-zinc-400 font-light max-w-2xl leading-relaxed">
              Segunda edición de la única e inigualble TRIPLE NELSON. Otro año mas donde podremos disfrutar de un día lleno de emoción, divertidos eventos, premios y la mejor música del panorama del techno nacional!
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <button className="btn-primary glow-hover text-xs md:text-sm py-3 md:py-4">
                Conseguir Entrada
              </button>
              <Link href="/lineup" className="btn-secondary text-xs md:text-sm py-3 md:py-4 text-center">
                Ver Line-up
              </Link>
            </div>

            <div className="flex items-center gap-4 md:gap-5 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs md:text-sm text-zinc-500 uppercase tracking-wider">En Vivo</span>
              </div>
              <div className="h-4 w-px bg-zinc-800" />
              <span className="text-xs md:text-sm text-zinc-500">20 Junio 2026</span>
            </div>
          </div>

        </div>
      </section>

      {/* Artists Marquee - Hidden on mobile */}
      <section className="hidden md:block relative overflow-hidden border-t border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
        <div className="flex animate-marquee whitespace-nowrap py-4 md:py-6 lg:py-7">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center">
              <span className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-8 md:px-12">
                DJ NELSON B2B DJ LOMAS
              </span>
              <span className="text-zinc-800 text-xl md:text-3xl">●</span>
              <span className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-8 md:px-12">
                YANN
              </span>
              <span className="text-zinc-800 text-xl md:text-3xl">●</span>
              <span className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-8 md:px-12">
                DJ TRUJINI LOQUINI
              </span>
              <span className="text-zinc-800 text-xl md:text-3xl">●</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

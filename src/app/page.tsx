'use client';

import { useEffect, useState } from 'react';

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
    <div className="min-h-screen bg-techno">
      
      {/* Hero Section */}
      <section className="container-pro py-6 md:py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 lg:gap-12">
          
          {/* Mobile: Title First */}
          <div className="lg:col-span-7 lg:order-1 order-1">
            <h1 className="font-display font-bold text-4xl md:text-7xl lg:text-8xl leading-none tracking-tighter">
              TRIPLE
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
                NELSON
              </span>
            </h1>
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent mt-3 md:mt-6 lg:hidden" />
          </div>

          {/* Mobile: Countdown Second */}
          <div className="lg:col-span-5 lg:order-2 order-2">
            <div className="card py-4 md:py-8">
              <div className="text-center mb-3 md:mb-6">
                <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-zinc-500 font-medium">
                  Cuenta Regresiva
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div className="countbox group py-3 md:py-6">
                  <div className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-1 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600">Días</div>
                </div>

                <div className="countbox group py-3 md:py-6">
                  <div className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-1 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600">Horas</div>
                </div>

                <div className="countbox group py-3 md:py-6">
                  <div className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-1 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600">Min</div>
                </div>

                <div className="countbox group py-3 md:py-6">
                  <div className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-1 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-600">Seg</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Description & Buttons Third */}
          <div className="lg:col-span-7 lg:order-3 order-3 space-y-3 md:space-y-6 lg:space-y-8">
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent hidden lg:block" />
            
            <p className="text-sm md:text-xl lg:text-2xl text-zinc-400 font-light max-w-2xl leading-relaxed">
              Segunda edición de la única e inigualble TRIPLE NELSON. Otro año mas donde podremos disfrutar de un día lleno de emoción, divertidos eventos, premios y la mejor música del panorama del techno nacional!
            </p>

            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <button className="btn-primary glow-hover text-sm md:text-base py-3 md:py-4">
                Conseguir Entrada
              </button>
              <button className="btn-secondary text-sm md:text-base py-3 md:py-4">
                Ver Line-up
              </button>
            </div>

            <div className="flex items-center gap-4 md:gap-6 pt-2 md:pt-4">
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

    </div>
  );
}

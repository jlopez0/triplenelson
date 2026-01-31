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
      <section className="container-pro py-20 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column - Content */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <h1 className="font-display font-bold text-6xl md:text-7xl lg:text-8xl leading-none tracking-tighter">
                TRIPLE
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
                  NELSON
                </span>
              </h1>
              
              <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent" />
              
              <p className="text-xl md:text-2xl text-zinc-400 font-light max-w-2xl leading-relaxed">
                Segunda edición de la única e inigualble TRIPLE NELSON. Otro año mas donde podremos disfrutar de un día lleno de emoción, divertidos eventos, premios y la mejor música del panorama del techno nacional!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button className="btn-primary glow-hover">
                Conseguir Entrada
              </button>
              <button className="btn-secondary">
                Ver Line-up
              </button>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm text-zinc-500 uppercase tracking-wider">En Vivo</span>
              </div>
              <div className="h-4 w-px bg-zinc-800" />
              <span className="text-sm text-zinc-500">20 Junio 2026</span>
            </div>
          </div>

          {/* Right Column - Countdown */}
          <div className="lg:col-span-5">
            <div className="card">
              <div className="text-center mb-8">
                <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-medium">
                  Cuenta Regresiva
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="countbox group">
                  <div className="text-5xl md:text-6xl font-display font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-zinc-600">Días</div>
                </div>

                <div className="countbox group">
                  <div className="text-5xl md:text-6xl font-display font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-zinc-600">Horas</div>
                </div>

                <div className="countbox group">
                  <div className="text-5xl md:text-6xl font-display font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-zinc-600">Minutos</div>
                </div>

                <div className="countbox group">
                  <div className="text-5xl md:text-6xl font-display font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-zinc-600">Segundos</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}

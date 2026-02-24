import Link from 'next/link';
import { HomeCountdown } from '@/components/features/HomeCountdown';
import { getTimeLeft } from '@/lib/countdown';

export const dynamic = 'force-dynamic';

const TARGET_TIMESTAMP = new Date('2026-06-20T23:59:59').getTime();

export default function HomePage() {
  const initialTimeLeft = getTimeLeft(TARGET_TIMESTAMP);

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

              <HomeCountdown initialTimeLeft={initialTimeLeft} targetTimestamp={TARGET_TIMESTAMP} />
            </div>
          </div>

          {/* Description & Buttons */}
          <div className="lg:col-span-7 lg:order-3 order-3 space-y-3 md:space-y-5 lg:space-y-6">
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent hidden lg:block" />

            <p className="text-sm md:text-lg lg:text-xl text-zinc-400 font-light max-w-2xl leading-relaxed">
              Segunda edicion de la unica e inigualable TRIPLE NELSON. Otro ano mas donde podremos disfrutar de un dia lleno de emocion, divertidos eventos, premios y la mejor musica del panorama del techno nacional.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="btn-primary text-xs md:text-sm py-3 md:py-4 opacity-60 cursor-not-allowed"
                title="Proximamente"
              >
                Entradas Proximamente
              </button>
              <Link href="/lineup" className="btn-secondary text-xs md:text-sm py-3 md:py-4 text-center">
                Ver Line-up
              </Link>
            </div>
            <p className="text-xs md:text-sm text-zinc-500">La compra de entradas aun no esta implementada.</p>

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
              <span className="text-zinc-800 text-xl md:text-3xl">&bull;</span>
              <span className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-8 md:px-12">
                YANN
              </span>
              <span className="text-zinc-800 text-xl md:text-3xl">&bull;</span>
              <span className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-8 md:px-12">
                DJ TRUJINI LOQUINI
              </span>
              <span className="text-zinc-800 text-xl md:text-3xl">&bull;</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

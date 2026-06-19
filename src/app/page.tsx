import Link from 'next/link';
import dynamic from 'next/dynamic';
import { HomeCountdown } from '@/components/features/HomeCountdown';
import { getTimeLeft } from '@/lib/countdown';
import { getAdminApp } from '@/lib/kahoot/firebase-admin';

const UfoAnimation = dynamic(() => import('@/components/UfoAnimation').then(m => ({ default: m.UfoAnimation })), {
  ssr: false,
});

export const revalidate = 0;

const TARGET_TIMESTAMP = new Date('2026-06-20T17:00:00').getTime();
const ENV = process.env.NEXT_PUBLIC_FIREBASE_ENV ?? 'dev';

function isPhotosVisible(): boolean {
  const v = (process.env.FEATURE_PHOTOS_BUTTON_VISIBLE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function getActiveKahootGame(): Promise<string | null> {
  try {
    const snap = await getAdminApp().ref(`${ENV}/activeGame`).get();
    return snap.exists() ? (snap.val() as string) : null;
  } catch {
    return null;
  }
}

async function getActiveRouletteSession(): Promise<string | null> {
  try {
    const snap = await getAdminApp().ref(`${ENV}/activeRouletteSession`).get();
    return snap.exists() ? (snap.val() as string) : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const initialTimeLeft = getTimeLeft(TARGET_TIMESTAMP);
  const [activeGameId, activeSessionId] = await Promise.all([
    getActiveKahootGame(),
    getActiveRouletteSession(),
  ]);
  const photosVisible = isPhotosVisible();

  const marqueeArtists = [
    'DJ LOMAS',
    'LÁTIGO',
    'DJ ALI',
    'WA:DA',
    'DJ NELSON B2B JEAN QUIROGA',
    'TABU VIVAR B2B KBNUX',
    'MEXE B2B ANTØNIK',
    'JIMBO',
  ];

  return (
    <div className="h-[100dvh] bg-techno flex flex-col overflow-hidden">
      <UfoAnimation />
      <div className="relative z-[1] flex flex-col flex-1 min-h-0">
      {/* Hero Section - cabe en una pantalla (sin scroll) */}
      <section className="container-pro py-3 md:py-8 lg:py-10 flex-1 flex items-center min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 lg:gap-10 w-full">
          {/* Title */}
          <div className="lg:col-span-7 lg:order-1 order-1">
            <h1 className="font-display font-bold text-[44px] sm:text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tighter">
              TRIPLE
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
                NELSON
              </span>
            </h1>
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent mt-3 md:mt-5 lg:hidden" />
          </div>

          {/* Countdown */}
          {(() => {
            const isLive = initialTimeLeft.days === 0 && initialTimeLeft.hours === 0 && initialTimeLeft.minutes === 0 && initialTimeLeft.seconds === 0;
            return (
              <div className="lg:col-span-5 lg:order-2 order-2">
                <div className={`rounded-2xl md:rounded-3xl ${isLive ? "" : "border border-zinc-800/80 bg-black/40 backdrop-blur-sm p-3 md:p-6 lg:p-8"}`}>
                  {!isLive && (
                    <div className="text-center mb-2 md:mb-5">
                      <span className="text-[9px] md:text-xs uppercase tracking-[0.3em] text-zinc-500 font-medium">
                        Cuenta Regresiva
                      </span>
                    </div>
                  )}
                  <HomeCountdown initialTimeLeft={initialTimeLeft} targetTimestamp={TARGET_TIMESTAMP} />
                </div>
              </div>
            );
          })()}

          {/* Description & Buttons */}
          <div className="lg:col-span-7 lg:order-3 order-3 space-y-2.5 md:space-y-5 lg:space-y-6">
            <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent hidden lg:block" />

            <p className="text-[13px] leading-snug md:text-lg lg:text-xl text-zinc-400 font-light max-w-2xl md:leading-relaxed line-clamp-4 md:line-clamp-none">
              Segunda edición de la única e inigualable TRIPLE NELSON. Otro año más donde podremos disfrutar de un día lleno de emoción, divertidos eventos, premios y la mejor música del panorama del techno nacional.
            </p>

            <div className="flex flex-row gap-2 md:gap-4 md:flex-row">
              <Link href="/aportar" className="btn-primary text-[11px] md:text-sm py-2.5 md:py-4 px-3 md:px-6 text-center flex-1">
                Conseguir Entrada
              </Link>
              {activeGameId ? (
                <Link href={`/kahoot/${activeGameId}`} className="btn-secondary text-[11px] md:text-sm py-2.5 md:py-4 px-3 md:px-6 text-center flex-1">
                  Kahoot
                </Link>
              ) : null}
              {activeSessionId ? (
                <Link href={`/ruleta/${activeSessionId}`} className="btn-secondary text-[11px] md:text-sm py-2.5 md:py-4 px-3 md:px-6 text-center flex-1">
                  Ruleta
                </Link>
              ) : null}
              <Link href="/lineup" className="btn-secondary text-[11px] md:text-sm py-2.5 md:py-4 px-3 md:px-6 text-center flex-1">
                Line-up
              </Link>
              {photosVisible ? (
                <Link href="/fotos" className="btn-secondary text-[11px] md:text-sm py-2.5 md:py-4 px-3 md:px-6 text-center flex-1">
                  📸 Fotos
                </Link>
              ) : null}
            </div>

            <div className="flex items-center gap-3 md:gap-5 pt-1 md:pt-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] md:text-sm text-zinc-500 uppercase tracking-wider">En Vivo</span>
              </div>
              <div className="h-3 md:h-4 w-px bg-zinc-800" />
              <span className="text-base md:text-3xl font-display font-bold tracking-tight text-zinc-200">20 Junio 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Artists Marquee */}
      <section className="relative overflow-hidden border-t border-zinc-800 bg-zinc-950/50 backdrop-blur-sm shrink-0">
        <div className="flex animate-marquee whitespace-nowrap py-2.5 md:py-6 lg:py-7">
          {[...Array(3)].map((_, blockIndex) => (
            <div key={blockIndex} className="flex items-center">
              {marqueeArtists.map((artist, i) => (
                <span key={`${blockIndex}-${i}`} className="flex items-center">
                  <span className="text-base md:text-4xl lg:text-5xl font-display font-bold text-zinc-700 hover:text-white transition-colors duration-500 px-4 md:px-12">
                    {artist}
                  </span>
                  <span className="text-zinc-800 text-sm md:text-3xl">&bull;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

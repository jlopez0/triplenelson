'use client';

import Link from 'next/link';

const ARTISTS = [
  { name: 'DJ LOMAS',                  start: '19:00', end: '21:00' },
  { name: 'DJ ALIA',                   start: '21:00', end: '23:30' },
  { name: 'DASFUNK',                   start: '23:30', end: '01:00' },
  { name: 'DJ NELSON b2b JEANQUIROGA', start: '01:00', end: '02:30', highlight: true },
  { name: 'ANTEKA',                    start: '02:30', end: '03:45' },
  { name: 'MEXE',                      start: '03:45', end: '05:00' },
  { name: 'LATIGO',                    start: '05:00', end: '06:15' },
];

export default function LineupPage() {
  return (
    <div className="min-h-screen bg-techno">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/70 backdrop-blur-md">
        <div className="container-pro flex items-center justify-between py-4">
          <Link href="/" className="font-display text-lg font-bold tracking-tighter transition-colors hover:text-zinc-300">
            TRIPLE NELSON
          </Link>
          <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 transition-colors hover:text-white">
            Volver
          </Link>
        </div>
      </header>

      <main className="container-pro pb-20 pt-10">
        {/* Cabecera */}
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.36em] text-zinc-500">20 Junio 2026</p>
          <h1 className="mt-2 font-display text-6xl font-bold tracking-tighter">LINE-UP</h1>
          <div className="mt-3 h-px max-w-[160px] bg-gradient-to-r from-zinc-500 to-transparent" />
          <p className="mt-4 text-sm text-zinc-600">{ARTISTS.length} artistas</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Línea vertical */}
          <div className="absolute bottom-0 left-[52px] top-0 w-px bg-gradient-to-b from-zinc-700 via-zinc-800 to-transparent" />

          <ol className="flex flex-col">
            {ARTISTS.map((artist, i) => {
              const isLast = i === ARTISTS.length - 1;
              return (
                <li
                  key={i}
                  className={`group relative flex items-start gap-0 ${isLast ? '' : 'pb-9'}`}
                >
                  {/* Hora */}
                  <div className="w-[52px] shrink-0 pt-[14px] text-right pr-4">
                    <span className={`font-mono text-[13px] tabular-nums transition-colors ${
                      artist.highlight
                        ? 'font-bold text-zinc-200 group-hover:text-white'
                        : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}>
                      {artist.start}
                    </span>
                  </div>

                  {/* Dot */}
                  <div className="relative shrink-0 pt-[18px]">
                    <div className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                      artist.highlight
                        ? 'border-zinc-400 bg-zinc-800 group-hover:border-white group-hover:bg-white group-hover:shadow-[0_0_16px_rgba(255,255,255,0.6)]'
                        : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-400 group-hover:bg-zinc-700'
                    }`} />
                  </div>

                  {/* Contenido */}
                  <div className="ml-5 flex-1 pt-2">
                    <h2 className={`font-display font-bold leading-tight tracking-tight transition-colors duration-200 ${
                      artist.highlight
                        ? 'text-3xl text-zinc-100 group-hover:text-white sm:text-4xl'
                        : 'text-2xl text-zinc-300 group-hover:text-white sm:text-3xl'
                    }`}>
                      {artist.name}
                    </h2>

                    {artist.highlight && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-400 group-hover:bg-white" />
                        Headliner
                      </span>
                    )}
                  </div>
                </li>
              );
            })}

            {/* Hora de cierre */}
            <li className="relative flex items-center gap-0">
              <div className="w-[52px] shrink-0 pr-4 text-right">
                <span className="font-mono text-[13px] tabular-nums text-zinc-700">
                  {ARTISTS[ARTISTS.length - 1].end}
                </span>
              </div>
              <div className="h-2 w-2 shrink-0 rounded-full border border-zinc-800 bg-zinc-950" />
            </li>
          </ol>
        </div>

        <p className="mt-16 text-xs text-zinc-700">
          El horario puede sufrir modificaciones.
        </p>
      </main>
    </div>
  );
}

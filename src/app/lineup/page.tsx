'use client';

import Link from 'next/link';

export default function LineupPage() {
  const artists = [
    {
      name: 'DJ NELSON B2B DJ LOMAS',
      time: '22:00 - 00:00',
      style: 'Ya veremos'
    },
    {
      name: 'YANN',
      time: '00:00 - 02:00',
      style: 'Trance / Psytrance'
    },
    {
      name: 'DJ TRUJINI LOQUINI',
      time: '02:00 - 04:00',
      style: 'Hard Techno'
    }
  ];

  return (
    <div className="min-h-screen bg-techno">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="container-pro py-4 md:py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl md:text-2xl font-display font-bold tracking-tighter hover:text-zinc-300 transition-colors">
              TRIPLE NELSON
            </Link>
            <Link href="/" className="text-xs md:text-sm text-zinc-500 hover:text-white transition-colors uppercase tracking-wider">
              Volver
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-pro py-8 md:py-12 lg:py-16">
        {/* Title Section */}
        <div className="mb-8 md:mb-12">
          <h1 className="font-display font-bold text-4xl md:text-6xl lg:text-7xl tracking-tighter mb-3 md:mb-4">
            LINE-UP
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
              2026
            </span>
          </h1>
          <div className="h-px bg-gradient-to-r from-zinc-700 via-zinc-500 to-transparent max-w-md" />
          <p className="text-sm md:text-base text-zinc-500 mt-3 md:mt-4">
            20 Junio 2026 · 3 Artistas confirmados · Resto por definir
          </p>
        </div>

        {/* Artists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {artists.map((artist, index) => (
            <div
              key={index}
              className="group card hover:border-zinc-600 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            >
              {/* Artist Number */}
              <div className="flex items-start justify-between mb-4 md:mb-6">
                <span className="text-5xl md:text-6xl font-display font-bold text-zinc-800 group-hover:text-zinc-700 transition-colors">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-zinc-600 mb-1">Horario</div>
                  <div className="text-sm md:text-base font-medium text-zinc-400">{artist.time}</div>
                </div>
              </div>

              {/* Artist Name */}
              <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-3 md:mb-4 leading-tight">
                {artist.name}
              </h2>

              {/* Style */}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-xs md:text-sm text-zinc-500 uppercase tracking-wider">
                  {artist.style}
                </span>
              </div>
            </div>
          ))}

          <div className="card border-dashed border-zinc-700/80 bg-zinc-950/30">
            <div className="flex items-start justify-between mb-4 md:mb-6">
              <span className="text-5xl md:text-6xl font-display font-bold text-zinc-800">??</span>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-zinc-600 mb-1">Horario</div>
                <div className="text-sm md:text-base font-medium text-zinc-500">Por definir</div>
              </div>
            </div>

            <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-3 md:mb-4 leading-tight text-zinc-300">
              Proximos artistas
            </h2>

            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span className="text-xs md:text-sm text-zinc-500 uppercase tracking-wider">
                Anuncio pendiente
              </span>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-12 md:mt-16 text-center">
          <div className="inline-block card max-w-2xl">
            <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
              El horario puede sufrir modificaciones. Mantente atento a nuestras redes sociales para actualizaciones en tiempo real del evento.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

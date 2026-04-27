"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function KahootJoinPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleanGameId = gameId.replace(/\D/g, "").slice(0, 6);
    if (!cleanGameId) return;
    router.push(`/kahoot/${cleanGameId}`);
  }

  return (
    <main className="min-h-screen bg-techno px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col justify-center">
        <Link
          href="/"
          className="font-display text-sm uppercase tracking-[0.35em] text-zinc-500"
        >
          Triple Nelson
        </Link>
        <p className="mt-10 text-xs uppercase tracking-[0.35em] text-cyan-300">
          Kahoot live
        </p>
        <h1 className="mt-3 font-display text-6xl font-bold leading-none tracking-tight">
          Entra en la partida
        </h1>
        <p className="mt-5 text-base leading-relaxed text-zinc-400">
          Introduce el codigo que aparece en la pantalla del evento.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            value={gameId}
            onChange={(event) => setGameId(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            className="w-full rounded-lg border border-zinc-700 bg-black/70 px-5 py-5 text-center font-mono text-4xl tracking-[0.25em] outline-none focus:border-cyan-300"
          />
          <button
            type="submit"
            disabled={!gameId.trim()}
            className="w-full rounded-lg bg-white px-5 py-5 text-sm font-bold uppercase tracking-[0.28em] text-black transition hover:bg-cyan-200 active:scale-[0.98] disabled:opacity-50"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

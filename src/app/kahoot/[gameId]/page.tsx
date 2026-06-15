"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  getLeaderboardFromPlayers,
  joinGame,
  submitAnswer,
  subscribeAnswersForQuestion,
  subscribeCorrectIndex,
  subscribeGame,
  subscribePlayer,
  subscribePlayers,
} from "@/lib/kahoot/rtdb";
import type { AnswerIndex, GameAnswer, GamePlayer, GameState } from "@/lib/kahoot/types";

const ANSWER_STYLES = [
  "bg-[#e21b3c] active:bg-[#ba1831]",
  "bg-[#1368ce] active:bg-[#0f56aa]",
  "bg-[#d89e00] active:bg-[#b78400]",
  "bg-[#26890c] active:bg-[#1f700a]",
] as const;

function useCountdown(game: GameState | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(id);
  }, []);

  if (!game?.currentQuestion) {
    return { remainingMs: 0, progress: 0 };
  }

  const totalMs = game.currentQuestion.timeLimit * 1000;
  const elapsed = now - game.currentQuestion.startedAt;
  const remainingMs = Math.max(0, totalMs - elapsed);
  return {
    remainingMs,
    progress: Math.max(0, Math.min(1, remainingMs / totalMs)),
  };
}

export default function KahootPlayerPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const storageKey = `tn_kahoot_player_${gameId}`;

  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Record<string, GamePlayer>>({});
  const [joining, setJoining] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, GameAnswer>>({});
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { remainingMs, progress } = useCountdown(game);
  const playerCount = Object.keys(players).length;
  const leaderboard = useMemo(() => getLeaderboardFromPlayers(players), [players]);
  const myAnswer = playerId ? (questionAnswers[playerId] ?? null) : null;
  const allAnswered = playerCount > 0 && Object.keys(questionAnswers).length >= playerCount;
  const timeUp = game?.status === "question" && (remainingMs <= 0 || allAnswered);
  const myRank = useMemo(
    () => leaderboard.find((entry) => entry.playerId === playerId) ?? null,
    [leaderboard, playerId],
  );
  const topThree = leaderboard.slice(0, 3);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setPlayerId(stored);
  }, [storageKey]);

  useEffect(() => subscribeGame(gameId, setGame), [gameId]);
  useEffect(() => subscribePlayers(gameId, setPlayers), [gameId]);

  // Precargar imágenes de todas las preguntas en cuanto llegan del RTDB.
  useEffect(() => {
    const urls = game?.imageUrls;
    if (!urls?.length) return;
    urls.forEach((url) => {
      if (url) new window.Image().src = url;
    });
  }, [game?.imageUrls]);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      return;
    }

    return subscribePlayer(gameId, playerId, setPlayer);
  }, [gameId, playerId]);

  useEffect(() => {
    setAnswering(false);
    setQuestionAnswers({});
    setCorrectIndex(null);
  }, [game?.currentQuestionIndex]);

  useEffect(() => {
    if (!gameId || !game || game.currentQuestionIndex < 0) return;
    return subscribeAnswersForQuestion(gameId, game.currentQuestionIndex, setQuestionAnswers);
  }, [gameId, game?.currentQuestionIndex]);

  useEffect(() => {
    if (!gameId) return;
    return subscribeCorrectIndex(gameId, setCorrectIndex);
  }, [gameId]);


  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    setError("");
    try {
      const id = await joinGame(gameId, nickname);
      window.localStorage.setItem(storageKey, id);
      setPlayerId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setJoining(false);
    }
  }

  async function answer(optionIndex: AnswerIndex) {
    if (!game?.currentQuestion || !playerId || player?.answered || answering || remainingMs <= 0) {
      return;
    }

    setAnswering(true);
    setError("");
    try {
      const timeMs = Date.now() - game.currentQuestion.startedAt;
      await submitAnswer(
        gameId,
        playerId,
        game.currentQuestionIndex,
        optionIndex,
        timeMs,
      );
    } catch (err) {
      setAnswering(false);
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
    }
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Kahoot</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight">Partida no encontrada</h1>
          <Link href="/" className="mt-8 rounded-md border border-zinc-700 px-5 py-4 text-center text-xs uppercase tracking-[0.22em] text-zinc-300">
            Volver
          </Link>
        </div>
      </main>
    );
  }

  if (!playerId || !player) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <form onSubmit={handleJoin} className="mx-auto flex min-h-[78vh] max-w-md flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Game {gameId}</p>
          <h1 className="mt-3 font-display text-6xl font-bold leading-none tracking-tight">
            Entra al juego
          </h1>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={20}
            placeholder="Tu nickname"
            className="mt-8 w-full rounded-lg border border-zinc-700 bg-black/70 px-5 py-5 text-xl outline-none focus:border-cyan-300"
          />
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={joining || !nickname.trim()}
            className="mt-5 rounded-lg bg-white px-5 py-5 text-sm font-bold uppercase tracking-[0.28em] text-black transition active:scale-[0.98] disabled:opacity-50"
          >
            {joining ? "Entrando..." : "Jugar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-techno px-4 py-4">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Triple Nelson</p>
            <h1 className="font-display text-xl font-semibold">{player.name}</h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-cyan-200">{player.score ?? 0}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">puntos</p>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {game.status === "lobby" ? (
            <motion.section
              key="waiting"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="flex flex-1 flex-col justify-center py-8"
            >
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">Lobby</p>
              <h2 className="mt-3 font-display text-5xl font-bold leading-none tracking-tight">
                Esperando al host...
              </h2>
              <p className="mt-4 text-zinc-400">
                {playerCount} jugador{playerCount === 1 ? "" : "es"} en sala.
              </p>
              <div className="mt-7 grid grid-cols-2 gap-2">
                {Object.entries(players).slice(0, 12).map(([id, item]) => (
                  <div key={id} className="truncate rounded-md border border-zinc-800 bg-black/50 px-3 py-3 text-sm">
                    {item.name}
                  </div>
                ))}
              </div>
            </motion.section>
          ) : null}

          {game.status === "question" && game.currentQuestion ? (
            <motion.section
              key={`question-${game.currentQuestionIndex}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="flex min-h-0 flex-1 flex-col gap-[1.5vh] py-[1.5vh]"
            >
              {/* Timer */}
              <div className="shrink-0">
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-cyan-300 transition-[width]"
                    style={{ width: timeUp ? "0%" : `${progress * 100}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                  <span>Pregunta {game.currentQuestionIndex + 1} / {game.totalQuestions}</span>
                  {timeUp
                    ? <span className="text-amber-300">Tiempo agotado</span>
                    : <span>{Math.ceil(remainingMs / 1000)}s</span>}
                </div>
              </div>

              {/* Pregunta + imagen opcional */}
              <div className={`shrink-0 ${game.currentQuestion.imageUrl ? "flex gap-3" : ""}`}>
                <h2
                  className="font-display font-bold leading-tight tracking-tight"
                  style={{ fontSize: "clamp(1.1rem, 5vw, 1.6rem)" }}
                >
                  {game.currentQuestion.text}
                </h2>
                {game.currentQuestion.imageUrl ? (
                  <img
                    src={game.currentQuestion.imageUrl}
                    alt=""
                    className="h-[18vh] w-[40%] shrink-0 rounded-lg border border-zinc-800 object-cover"
                  />
                ) : null}
              </div>

              {/* Respuestas — ocupan todo el espacio restante */}
              <div className="grid min-h-0 flex-1 gap-[1.5vw]" style={{ gridTemplateRows: "1fr 1fr 1fr 1fr" }}>
                {game.currentQuestion.options.map((option, index) => {
                  const isCorrect = correctIndex !== null && index === correctIndex;
                  const isMyAnswer = myAnswer?.optionIndex === index;
                  const hasAnswered = player.answered || answering || myAnswer !== null;
                  const showResult = timeUp && correctIndex !== null;

                  let bg: string = ANSWER_STYLES[index];
                  let ring = "";
                  let dimmed = false;
                  let badge: React.ReactNode = null;

                  if (showResult) {
                    if (isMyAnswer && isCorrect) {
                      bg = "bg-[#16a34a]"; ring = "ring-4 ring-white";
                      badge = <span className="shrink-0 text-xl leading-none">✓</span>;
                    } else if (isMyAnswer) {
                      bg = "bg-[#dc2626]"; ring = "ring-4 ring-white";
                      badge = <span className="shrink-0 text-xl leading-none">✗</span>;
                    } else if (isCorrect) {
                      bg = "bg-[#16a34a]";
                      badge = <span className="shrink-0 text-xl leading-none">✓</span>;
                    } else {
                      bg = "bg-zinc-700"; dimmed = true;
                    }
                  } else if (hasAnswered) {
                    if (isMyAnswer) { ring = "ring-4 ring-white"; }
                    else { dimmed = true; }
                  }

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={timeUp || player.answered || answering}
                      onClick={() => void answer(index as AnswerIndex)}
                      className={`flex min-h-0 w-full items-center justify-between gap-2 overflow-hidden rounded-lg px-4 font-bold text-white shadow-lg transition active:scale-[0.98] ${bg} ${ring} ${dimmed ? "opacity-40" : ""}`}
                      style={{ fontSize: "clamp(0.85rem, 3.8vw, 1.15rem)" }}
                    >
                      <span className="min-w-0 text-left">{option}</span>
                      {badge}
                    </button>
                  );
                })}
              </div>

              {/* Feedback resultado */}
              {timeUp && correctIndex !== null ? (
                <div className={`shrink-0 rounded-lg border px-3 py-2 text-center text-sm font-bold ${
                  myAnswer?.optionIndex === correctIndex
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : myAnswer !== null
                      ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                      : "border-zinc-600/50 bg-zinc-800/40 text-zinc-400"
                }`}>
                  {myAnswer?.optionIndex === correctIndex
                    ? `¡Correcto! · +${player.lastGain ?? "..."} pts`
                    : myAnswer !== null ? "Incorrecto" : "¡Tiempo!"}
                </div>
              ) : timeUp ? (
                <p className="shrink-0 rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-center text-xs text-zinc-400">
                  Esperando resultados...
                </p>
              ) : player.answered || answering ? (
                <p className="shrink-0 rounded-lg border border-lime-400/40 bg-lime-400/10 px-3 py-2 text-center text-sm font-bold text-lime-200">
                  Enviado — espera al resto
                </p>
              ) : null}

              {!timeUp && error ? <p className="shrink-0 text-sm text-rose-300">{error}</p> : null}
              {timeUp ? <p className="shrink-0 text-center text-xs text-zinc-500">Esperando al host...</p> : null}
            </motion.section>
          ) : null}

          {game.status === "leaderboard" ? (
            <motion.section
              key="leaderboard"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="flex flex-1 flex-col justify-center py-8"
            >
              <p className="text-xs uppercase tracking-[0.32em] text-yellow-300">Entre preguntas</p>
              <div className="mt-3 flex items-end gap-4">
                <h2 className="font-display text-6xl font-bold leading-none tracking-tight">
                  #{myRank?.rank ?? "--"}
                </h2>
                <p className="mb-1 text-zinc-400">de {playerCount}</p>
              </div>
              <p className={`mt-2 text-xl ${player.lastGain ? "text-lime-300" : "text-zinc-500"}`}>
                {player.lastGain ? `+${player.lastGain} pts en la última` : "Sin puntos en la última"}
              </p>
              <div className="mt-6 space-y-2">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                      entry.playerId === playerId
                        ? "border-cyan-300 bg-cyan-300/10 font-semibold"
                        : "border-zinc-800 bg-black/50"
                    }`}
                  >
                    <span className="truncate">#{entry.rank} {entry.name}</span>
                    <span className="font-mono text-cyan-200">{entry.score}</span>
                  </div>
                ))}
                {myRank && myRank.rank > 5 ? (
                  <>
                    <p className="text-center text-xs text-zinc-600">···</p>
                    <div className="flex items-center justify-between rounded-md border border-cyan-300 bg-cyan-300/10 px-4 py-3 font-semibold">
                      <span className="truncate">#{myRank.rank} {player.name}</span>
                      <span className="font-mono text-cyan-200">{player.score ?? 0}</span>
                    </div>
                  </>
                ) : null}
              </div>
              <p className="mt-6 text-center text-sm text-zinc-500">Esperando al host...</p>
            </motion.section>
          ) : null}

          {game.status === "finished" ? (
            <motion.section
              key="finished"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              className="flex flex-1 flex-col py-6"
            >
              <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-300">
                Partida finalizada
              </p>

              {/* Resultado personal */}
              <div className="mt-4 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                  Tu resultado
                </p>
                <p className="mt-2 font-display text-7xl font-bold leading-none tracking-tight text-white">
                  {player.score ?? 0}
                </p>
                <p className="mt-1 text-sm text-cyan-200">puntos</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-300">
                  Posición #{myRank?.rank ?? "--"} de {playerCount}
                </p>
              </div>

              {/* Podio top 3 */}
              <div className="mt-6 grid grid-cols-3 items-end gap-2">
                {[topThree[1], topThree[0], topThree[2]].map((entry, index) => {
                  const place = index === 0 ? 2 : index === 1 ? 1 : 3;
                  const heights = ["h-24", "h-32", "h-16"];
                  const isMe = entry?.playerId === playerId;
                  return (
                    <div key={entry?.playerId ?? place} className="text-center">
                      <div className="mb-1 truncate text-xs text-zinc-400">
                        {entry?.name ?? "--"}
                      </div>
                      <div
                        className={`${heights[index]} flex flex-col items-center justify-center rounded-md border text-black ${
                          isMe
                            ? "border-cyan-300 bg-cyan-200"
                            : "border-zinc-600 bg-white"
                        }`}
                      >
                        <span className="font-display text-3xl font-bold">#{place}</span>
                        <span className="font-mono text-xs">{entry?.score ?? 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranking completo */}
              <div className="mt-6">
                <p className="mb-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
                  Clasificación final · {playerCount} jugadores
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.playerId}
                      className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
                        entry.playerId === playerId
                          ? "border-cyan-300 bg-cyan-300/10 font-semibold"
                          : "border-zinc-800 bg-black/50"
                      }`}
                    >
                      <span className="truncate">
                        <span className="mr-2 text-zinc-500">#{entry.rank}</span>
                        {entry.name}
                      </span>
                      <span className="font-mono text-cyan-200">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}

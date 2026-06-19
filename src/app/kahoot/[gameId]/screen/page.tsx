"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getLeaderboardFromPlayers,
  subscribeAnswersForQuestion,
  subscribeCorrectIndex,
  subscribeGame,
  subscribePlayers,
} from "@/lib/kahoot/rtdb";
import type { GameAnswer, GamePlayer, GameState } from "@/lib/kahoot/types";

const ANSWER_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"] as const;

function useCountdown(game: GameState | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(id);
  }, []);

  if (!game?.currentQuestion) return { remainingMs: 0, progress: 0 };

  const totalMs = game.currentQuestion.timeLimit * 1000;
  const remainingMs = Math.max(0, totalMs - (now - game.currentQuestion.startedAt));
  return {
    remainingMs,
    progress: Math.max(0, Math.min(1, remainingMs / totalMs)),
  };
}

export default function KahootScreenPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const [origin, setOrigin] = useState("");
  const [game, setGame] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Record<string, GamePlayer>>({});
  const [answers, setAnswers] = useState<Record<string, GameAnswer>>({});
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const { remainingMs, progress } = useCountdown(game);

  const joinUrl = origin ? `${origin}/kahoot/${gameId}` : `/kahoot/${gameId}`;
  const leaderboard = useMemo(() => getLeaderboardFromPlayers(players), [players]);
  const playerCount = Object.keys(players).length;
  const answerCount = Object.keys(answers).length;
  const answerProgress = playerCount ? answerCount / playerCount : 0;
  const allAnswered = playerCount > 0 && answerCount >= playerCount;
  const timeUp = game?.status === "question" && (remainingMs <= 0 || allAnswered);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const offGame = subscribeGame(gameId, setGame);
    const offPlayers = subscribePlayers(gameId, setPlayers);
    return () => {
      offGame();
      offPlayers();
    };
  }, [gameId]);

  // Precargar imágenes de todas las preguntas en cuanto llega el GameState.
  useEffect(() => {
    const urls = game?.imageUrls;
    if (!urls?.length) return;
    urls.forEach((url) => {
      if (url) new window.Image().src = url;
    });
  }, [game?.imageUrls]);

  useEffect(() => {
    if (!game || game.currentQuestionIndex < 0) {
      setAnswers({});
      return;
    }

    return subscribeAnswersForQuestion(gameId, game.currentQuestionIndex, setAnswers);
  }, [gameId, game?.currentQuestionIndex]);

  useEffect(() => {
    setCorrectIndex(null);
  }, [game?.currentQuestionIndex]);

  useEffect(() => {
    if (!gameId) return;
    return subscribeCorrectIndex(gameId, setCorrectIndex);
  }, [gameId]);

  return (
    <main className="h-[100dvh] overflow-hidden bg-techno px-6 py-5 text-white lg:px-8">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300 md:text-sm">Triple Nelson Kahoot</p>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              {game?.status === "lobby" ? "Lobby" : `Game ${gameId}`}
            </h1>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-black/60 px-5 py-3 text-right md:px-6 md:py-4">
            <p className="font-mono text-4xl text-cyan-200 md:text-5xl">{gameId}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">codigo</p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {!game ? (
            <motion.section
              key="missing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center"
            >
              <h2 className="font-display text-7xl font-bold">Partida no encontrada</h2>
            </motion.section>
          ) : null}

          {game?.status === "lobby" ? (
            <motion.section
              key="lobby"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="grid min-h-0 flex-1 gap-10 py-[2vh] lg:grid-cols-[440px_1fr]"
            >
              <div className="flex flex-col justify-center">
                <div className="rounded-lg border border-white/20 bg-white p-7">
                  <QRCodeSVG value={joinUrl} size={360} includeMargin />
                </div>
                <p className="mt-5 break-all rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-5 py-4 font-mono text-xl text-cyan-100">
                  {joinUrl}
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <p className="text-sm uppercase tracking-[0.4em] text-lime-300">Jugadores</p>
                <h2 className="mt-2 font-display text-8xl font-bold tracking-tight">
                  {playerCount}
                </h2>
                <div className="mt-8 grid max-h-[58vh] grid-cols-3 gap-2 overflow-y-auto overflow-x-hidden xl:grid-cols-4">
                  {Object.entries(players).map(([playerId, player], index) => (
                    <motion.div
                      key={playerId}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(index * 0.02, 0.35) }}
                      className="truncate rounded-lg border border-zinc-800 bg-black/50 px-3 py-2.5 text-base font-semibold"
                    >
                      {player.name}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : null}

          {game?.status === "question" && game.currentQuestion ? (
            <motion.section
              key={`question-${game.currentQuestionIndex}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="flex min-h-0 flex-1 flex-col gap-[1.5vh] py-[2vh]"
            >
              {/* Barra de progreso + timer — siempre arriba */}
              <div className="shrink-0">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-zinc-400 md:text-sm">
                  <span>Pregunta {game.currentQuestionIndex + 1} / {game.totalQuestions}</span>
                  {timeUp ? (
                    <span className="text-amber-300">Tiempo agotado</span>
                  ) : (
                    <span>{Math.ceil(remainingMs / 1000)} segundos</span>
                  )}
                </div>
                {!timeUp ? (
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-[width]"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                ) : null}
              </div>

              {game.currentQuestion.imageUrl ? (
                /* ── CON IMAGEN: pregunta izquierda | imagen derecha, luego respuestas abajo ── */
                <>
                  <div className="grid min-h-0 shrink-0 gap-6 lg:grid-cols-[1fr_1fr]" style={{ height: "38vh" }}>
                    {/* Pregunta */}
                    <div className="flex min-h-0 items-center">
                      <h2
                        className="font-display font-bold leading-[1.05] tracking-tight"
                        style={{ fontSize: "clamp(1.6rem, 3.6vw, 4.5rem)" }}
                      >
                        {game.currentQuestion.text}
                      </h2>
                    </div>
                    {/* Imagen — ocupa todo el alto del contenedor */}
                    <div className="min-h-0 overflow-hidden rounded-xl border border-zinc-800">
                      <img
                        src={game.currentQuestion.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
                    {game.currentQuestion.options.map((option, index) => {
                      const isCorrect = correctIndex !== null && index === correctIndex;
                      const showResult = timeUp && correctIndex !== null;
                      const bg = showResult ? (isCorrect ? "#16a34a" : "#3f3f46") : ANSWER_COLORS[index];
                      return (
                        <motion.div
                          key={option}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          className="flex min-h-0 items-center justify-between gap-4 overflow-hidden rounded-lg px-6 py-3 font-bold leading-tight text-white shadow-2xl transition-all"
                          style={{
                            backgroundColor: bg,
                            fontSize: "clamp(1.1rem, 2.2vw, 2.2rem)",
                            opacity: showResult && !isCorrect ? 0.45 : 1,
                            outline: showResult && isCorrect ? "6px solid white" : "none",
                            transform: showResult && isCorrect ? "scale(1.02)" : "scale(1)",
                          }}
                        >
                          <span className="min-w-0">{option}</span>
                          {showResult ? <span className="shrink-0 text-[1.4em]">{isCorrect ? "✓" : "✗"}</span> : null}
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* ── SIN IMAGEN: pregunta arriba (crece según texto), respuestas llenan el resto ── */
                <>
                  <div className="shrink-0">
                    <h2
                      className="font-display font-bold leading-[1.05] tracking-tight"
                      style={{ fontSize: "clamp(2.2rem, 5.5vw, 7rem)" }}
                    >
                      {game.currentQuestion.text}
                    </h2>
                  </div>
                  <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
                    {game.currentQuestion.options.map((option, index) => {
                      const isCorrect = correctIndex !== null && index === correctIndex;
                      const showResult = timeUp && correctIndex !== null;
                      const bg = showResult ? (isCorrect ? "#16a34a" : "#3f3f46") : ANSWER_COLORS[index];
                      return (
                        <motion.div
                          key={option}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          className="flex min-h-0 items-center justify-between gap-4 overflow-hidden rounded-lg px-8 py-4 font-bold leading-tight text-white shadow-2xl transition-all"
                          style={{
                            backgroundColor: bg,
                            fontSize: "clamp(1.4rem, 2.8vw, 2.8rem)",
                            opacity: showResult && !isCorrect ? 0.45 : 1,
                            outline: showResult && isCorrect ? "6px solid white" : "none",
                            transform: showResult && isCorrect ? "scale(1.02)" : "scale(1)",
                          }}
                        >
                          <span className="min-w-0">{option}</span>
                          {showResult ? <span className="shrink-0 text-[1.4em]">{isCorrect ? "✓" : "✗"}</span> : null}
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}


              {!timeUp ? (
                <div className="shrink-0 rounded-lg border border-zinc-800 bg-black/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-400 md:text-sm">Respuestas</p>
                    <p className="font-mono text-2xl text-cyan-200 md:text-3xl">
                      {answerCount}/{playerCount}
                    </p>
                  </div>
                  <div className="mt-2 h-5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-lime-300 transition-[width]"
                      style={{ width: `${answerProgress * 100}%` }}
                    />
                  </div>
                </div>
              ) : correctIndex !== null ? (
                (() => {
                  const correctCount = Object.values(answers).filter(
                    (a) => a.optionIndex === correctIndex,
                  ).length;
                  const wrongCount = answerCount - correctCount;
                  const total = Math.max(1, answerCount);
                  return (
                    <div className="shrink-0 rounded-lg border border-zinc-800 bg-black/50 p-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] md:text-sm">
                        <span className="text-emerald-300">Acertaron · {correctCount}</span>
                        <span className="text-rose-300">Fallaron · {wrongCount}</span>
                      </div>
                      <div className="mt-2 flex h-5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-emerald-500 transition-[width]"
                          style={{ width: `${(correctCount / total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-rose-500 transition-[width]"
                          style={{ width: `${(wrongCount / total) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-center text-xs text-zinc-400 md:text-sm">
                        Esperando al host para continuar...
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-300 md:text-sm">
                    {allAnswered ? `Todos respondieron · ${answerCount}/${playerCount}` : `Respondieron · ${answerCount}/${playerCount}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 md:text-sm">Esperando al host para revelar...</p>
                </div>
              )}
            </motion.section>
          ) : null}

          {game?.status === "leaderboard" ? (
            <motion.section
              key="leaderboard"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="flex flex-1 flex-col justify-center py-10"
            >
              <p className="text-sm uppercase tracking-[0.4em] text-yellow-300">Leaderboard</p>
              <h2 className="mt-2 font-display text-8xl font-bold tracking-tight">Top 5</h2>
              <div className="mt-10 space-y-4">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <motion.div
                    key={entry.playerId}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.12, type: "spring", stiffness: 120 }}
                    className="grid grid-cols-[100px_1fr_220px] items-center rounded-lg border border-zinc-800 bg-black/60 px-8 py-5"
                  >
                    <span className="font-display text-5xl font-bold text-zinc-500">#{entry.rank}</span>
                    <span className="truncate text-5xl font-bold">{entry.name}</span>
                    <span className="text-right font-mono text-5xl text-cyan-200">{entry.score}</span>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ) : null}

          {game?.status === "finished" ? (
            <motion.section
              key="finished"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="flex min-h-0 flex-1 flex-col justify-center py-[2vh]"
            >
              <p className="text-sm uppercase tracking-[0.4em] text-fuchsia-300">Final</p>
              <h2 className="mt-2 font-display text-6xl font-bold tracking-tight md:text-8xl">Podio</h2>
              <div className="mt-[4vh] grid grid-cols-3 items-end gap-6">
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, index) => {
                  const place = index === 0 ? 2 : index === 1 ? 1 : 3;
                  const heights = ["h-[30vh]", "h-[42vh]", "h-[23vh]"];
                  return (
                    <motion.div
                      key={entry?.playerId ?? place}
                      initial={{ opacity: 0, y: 80 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.16, type: "spring", stiffness: 90 }}
                      className="text-center"
                    >
                      <p className="mb-4 truncate text-5xl font-bold">{entry?.name ?? "--"}</p>
                      <div className={`${heights[index]} flex flex-col items-center justify-center rounded-lg border border-white/20 bg-white text-black`}>
                        <span className="font-display text-8xl font-bold">#{place}</span>
                        <span className="mt-4 font-mono text-5xl">{entry?.score ?? 0}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

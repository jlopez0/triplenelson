"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { uploadQuizQuestionImage } from "@/lib/kahoot/storage-client";
import {
  advanceQuestion,
  createGame,
  finishGame,
  getLeaderboardFromPlayers,
  showLeaderboard,
  subscribeAnswersForQuestion,
  subscribeCorrectIndex,
  subscribeGame,
  subscribePlayers,
} from "@/lib/kahoot/rtdb";
import type {
  AnswerIndex,
  AnswerOptions,
  GameAnswer,
  GamePlayer,
  GameState,
  Quiz,
  QuizDraftQuestion,
  QuizInput,
  QuizQuestion,
} from "@/lib/kahoot/types";

async function revealOnServer(gameId: string, token: string): Promise<void> {
  const res = await fetch("/kahoot/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ gameId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Error revelando respuesta correcta.");
  }
}

async function scoreOnServer(
  gameId: string,
  completedQuestionIndex: number,
  token: string,
): Promise<void> {
  const res = await fetch("/kahoot/api/advance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ gameId, completedQuestionIndex }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Error calculando puntos en servidor.");
  }
}

const TOKEN_KEY = "tn_kahoot_admin_token";
const GAME_ID_KEY = "tn_kahoot_admin_gameid";
const ANSWER_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"] as const;

type QuizDraft = Omit<QuizInput, "questions"> & {
  questions: QuizDraftQuestion[];
};

function emptyQuestion(): QuizDraftQuestion {
  return {
    text: "",
    imageUrl: null,
    options: ["", "", "", ""],
    correctIndex: 0,
    timeLimit: 20,
    pendingImageFile: null,
  };
}

function emptyDraft(): QuizDraft {
  return {
    title: "",
    event: "",
    questions: [emptyQuestion()],
  };
}

function authHeaders(token: string): HeadersInit {
  return { "x-admin-token": token };
}

function normalizeQuestion(question: QuizDraftQuestion): QuizQuestion {
  return {
    text: question.text.trim(),
    imageUrl: question.imageUrl || null,
    options: question.options.map((option) => option.trim()) as AnswerOptions,
    correctIndex: question.correctIndex,
    timeLimit: Math.max(5, Math.min(120, Number(question.timeLimit) || 20)),
  };
}

function ranking(players: Record<string, GamePlayer>) {
  return getLeaderboardFromPlayers(players);
}

export default function KahootAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuizDraft>(emptyDraft);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);

  const [gameId, setGameId] = useState("");
  const [game, setGame] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Record<string, GamePlayer>>({});
  const [answers, setAnswers] = useState<Record<string, GameAnswer>>({});
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const selectedQuiz = useMemo(
    () => quizzes.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );
  const leaderboard = useMemo(() => ranking(players), [players]);
  const currentQuestion = game && selectedQuiz
    ? selectedQuiz.questions[game.currentQuestionIndex]
    : null;
  const answerTotals = useMemo(() => {
    const totals = [0, 0, 0, 0];
    Object.values(answers).forEach((answer) => {
      totals[answer.optionIndex] += 1;
    });
    return totals;
  }, [answers]);

  useEffect(() => {
    const storedGame = window.localStorage.getItem(GAME_ID_KEY) ?? "";
    if (storedGame) setGameId(storedGame);

    const stored = window.localStorage.getItem(TOKEN_KEY) ?? "";
    if (!stored) {
      setAuthLoading(false);
      return;
    }
    setTokenInput(stored);
    void validateToken(stored);
  }, []);

  useEffect(() => {
    if (!isAuthed || !token) return;
    void loadQuizzes(token);
    void loadActiveGame();
  }, [isAuthed, token]);

  useEffect(() => {
    if (gameId) {
      window.localStorage.setItem(GAME_ID_KEY, gameId);
    } else {
      window.localStorage.removeItem(GAME_ID_KEY);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setPlayers({});
      return;
    }

    const offGame = subscribeGame(gameId, setGame);
    const offPlayers = subscribePlayers(gameId, setPlayers);
    return () => {
      offGame();
      offPlayers();
    };
  }, [gameId]);

  useEffect(() => {
    if (game?.quizId && !selectedQuizId) {
      setSelectedQuizId(game.quizId);
    }
  }, [game?.quizId]);

  useEffect(() => {
    if (!gameId || !game || game.currentQuestionIndex < 0) {
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

  async function validateToken(value = tokenInput) {
    setAuthLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/kahoot/api/auth", {
        headers: authHeaders(value.trim()),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Token incorrecto.");
      window.localStorage.setItem(TOKEN_KEY, value.trim());
      setToken(value.trim());
      setIsAuthed(true);
    } catch (err) {
      window.localStorage.removeItem(TOKEN_KEY);
      setIsAuthed(false);
      setLoginError(err instanceof Error ? err.message : "No se pudo validar.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenInput("");
    setIsAuthed(false);
    setGameId("");
  }

  async function loadQuizzes(activeToken = token) {
    setLoadingQuizzes(true);
    setError("");
    try {
      const res = await fetch("/kahoot/api/quizzes", {
        headers: authHeaders(activeToken),
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudieron cargar quizzes.");
      const items = payload.quizzes as Quiz[];
      setQuizzes(items);
      if (!selectedQuizId && items[0]) setSelectedQuizId(items[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando quizzes.");
    } finally {
      setLoadingQuizzes(false);
    }
  }

  function setQuestion(index: number, patch: Partial<QuizDraftQuestion>) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    }));
  }

  function setOption(questionIndex: number, optionIndex: number, value: string) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, i) => {
        if (i !== questionIndex) return question;
        const options = [...question.options] as AnswerOptions;
        options[optionIndex] = value;
        return { ...question, options };
      }),
    }));
  }

  function addQuestion() {
    setDraft((current) => ({
      ...current,
      questions: [...current.questions, emptyQuestion()],
    }));
  }

  function removeQuestion(index: number) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.filter((_, i) => i !== index),
    }));
  }

  function editQuiz(quiz: Quiz) {
    setEditingQuizId(quiz.id);
    setSelectedQuizId(quiz.id);
    setDraft({
      title: quiz.title,
      event: quiz.event,
      questions: quiz.questions.map((question) => ({
        ...question,
        pendingImageFile: null,
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveQuiz(event: React.FormEvent) {
    event.preventDefault();
    setSavingQuiz(true);
    setError("");
    setMessage("");

    try {
      if (!draft.title.trim()) throw new Error("Ponle titulo al quiz.");
      if (!draft.questions.length) throw new Error("Añade al menos una pregunta.");

      const questions: QuizQuestion[] = [];
      for (let i = 0; i < draft.questions.length; i += 1) {
        const q = draft.questions[i];
        if (!q.text.trim()) throw new Error(`Pregunta ${i + 1}: falta el texto.`);
        if (q.options.some((option) => !option.trim())) {
          throw new Error(`Pregunta ${i + 1}: completa las 4 opciones.`);
        }

        let imageUrl = q.imageUrl;
        if (q.pendingImageFile) {
          imageUrl = await uploadQuizQuestionImage(q.pendingImageFile, i);
        }

        questions.push(normalizeQuestion({ ...q, imageUrl }));
      }

      const payload: QuizInput = {
        title: draft.title.trim(),
        event: draft.event.trim(),
        questions,
      };
      const endpoint = editingQuizId
        ? `/kahoot/api/quizzes/${editingQuizId}`
        : "/kahoot/api/quizzes";
      const res = await fetch(endpoint, {
        method: editingQuizId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "No se pudo guardar.");

      setMessage(editingQuizId ? "Quiz actualizado." : "Quiz creado.");
      setDraft(emptyDraft());
      setEditingQuizId(null);
      await loadQuizzes();
      setSelectedQuizId(body.quiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el quiz.");
    } finally {
      setSavingQuiz(false);
    }
  }

  async function loadActiveGame() {
    try {
      const res = await fetch("/kahoot/api/active-game", { cache: "no-store" });
      const payload = await res.json();
      setActiveGameId((payload.gameId as string | null) ?? null);
    } catch {
      // non-critical
    }
  }

  async function setActiveGame(id: string | null) {
    setBusyAction("active");
    setError("");
    try {
      const res = await fetch("/kahoot/api/active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ gameId: id }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la partida activa.");
      setActiveGameId(id);
      setMessage(id ? `Partida ${id} activada. El botón en la home ya es visible.` : "Partida desactivada. El botón en la home está oculto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error activando partida.");
    } finally {
      setBusyAction("");
    }
  }

  async function startGame() {
    if (!selectedQuiz) return;
    setBusyAction("create");
    setError("");
    setMessage("");
    try {
      const id = await createGame(selectedQuiz.id, selectedQuiz.questions.length);
      setGameId(id);
      setMessage(`Partida ${id} creada. Abre la pantalla y deja entrar jugadores.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la partida.");
    } finally {
      setBusyAction("");
    }
  }

  async function goNextQuestion() {
    if (!selectedQuiz || !gameId || !game) return;
    setBusyAction("next");
    setError("");
    try {
      const completedIndex = game.currentQuestionIndex;
      const nextIndex = completedIndex + 1;

      if (game.status === "question" && completedIndex >= 0) {
        await scoreOnServer(gameId, completedIndex, token);
      }

      if (nextIndex >= selectedQuiz.questions.length) {
        await finishGame(gameId);
        return;
      }

      await advanceQuestion(gameId, nextIndex, selectedQuiz.questions[nextIndex]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo avanzar.");
    } finally {
      setBusyAction("");
    }
  }

  async function revealAnswer() {
    if (!gameId || !game || game.status !== "question") return;
    setBusyAction("reveal");
    setError("");
    try {
      await revealOnServer(gameId, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revelar la respuesta.");
    } finally {
      setBusyAction("");
    }
  }

  async function revealLeaderboard() {
    if (!gameId || !game) return;
    setBusyAction("leaderboard");
    setError("");
    try {
      if (game.status === "question" && game.currentQuestionIndex >= 0) {
        await scoreOnServer(gameId, game.currentQuestionIndex, token);
      }
      await showLeaderboard(gameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mostrar el ranking.");
    } finally {
      setBusyAction("");
    }
  }

  async function endGame() {
    if (!gameId || !game) return;
    setBusyAction("finish");
    setError("");
    try {
      if (game.status === "question" && game.currentQuestionIndex >= 0) {
        await scoreOnServer(gameId, game.currentQuestionIndex, token);
      }
      await finishGame(gameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo finalizar.");
    } finally {
      setBusyAction("");
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-black/60 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Validando host...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-techno flex items-center justify-center px-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void validateToken();
          }}
          className="w-full max-w-md rounded-lg border border-zinc-800 bg-black/70 p-6 shadow-2xl"
        >
          <Link href="/" className="font-display text-2xl font-bold tracking-tighter">
            TRIPLE NELSON
          </Link>
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
            Kahoot Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Acceso protegido con el token de admin.
          </p>
          <input
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="x-admin-token"
            type="password"
            className="mt-6 w-full rounded-md border border-zinc-700 bg-black px-4 py-3 text-sm outline-none focus:border-cyan-300"
          />
          {loginError ? <p className="mt-3 text-sm text-rose-300">{loginError}</p> : null}
          <button
            type="submit"
            className="mt-5 w-full rounded-md bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black transition hover:bg-cyan-200"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-techno px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-display text-sm uppercase tracking-[0.35em] text-zinc-500">
              Triple Nelson
            </Link>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
              Kahoot Control
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {gameId ? (
              <>
                <Link
                  href={`/kahoot/${gameId}/screen`}
                  target="_blank"
                  className="rounded-md border border-cyan-400/50 px-4 py-3 text-xs uppercase tracking-[0.24em] text-cyan-200 hover:bg-cyan-400/10"
                >
                  Pantalla
                </Link>
                <Link
                  href={`/kahoot/${gameId}`}
                  target="_blank"
                  className="rounded-md border border-zinc-700 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-200 hover:bg-white/10"
                >
                  Unirse
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-zinc-700 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-400 hover:text-white"
            >
              Salir
            </button>
          </div>
        </header>

        {message ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={saveQuiz}
            className="rounded-lg border border-zinc-800 bg-black/50 p-4 md:p-6"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Banco de quizzes
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold">
                  {editingQuizId ? "Editar quiz" : "Crear quiz"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingQuizId(null);
                  setDraft(emptyDraft());
                }}
                className="rounded-md border border-zinc-700 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-300"
              >
                Nuevo
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo del quiz"
                className="rounded-md border border-zinc-700 bg-black/70 px-4 py-3 text-sm outline-none focus:border-cyan-300"
              />
              <input
                value={draft.event}
                onChange={(event) => setDraft((current) => ({ ...current, event: event.target.value }))}
                placeholder="Evento"
                className="rounded-md border border-zinc-700 bg-black/70 px-4 py-3 text-sm outline-none focus:border-cyan-300"
              />
            </div>

            <div className="mt-5 space-y-4">
              {draft.questions.map((question, questionIndex) => (
                <div
                  key={questionIndex}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl">Pregunta {questionIndex + 1}</h3>
                    {draft.questions.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeQuestion(questionIndex)}
                        className="rounded-md border border-rose-500/40 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-200"
                      >
                        Borrar
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    value={question.text}
                    onChange={(event) => setQuestion(questionIndex, { text: event.target.value })}
                    placeholder="Texto de la pregunta"
                    rows={2}
                    className="mt-3 w-full resize-none rounded-md border border-zinc-700 bg-black/70 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  />

                  <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr]">
                    <label className="flex min-h-[112px] cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-700 bg-black/50 text-center text-xs uppercase tracking-[0.18em] text-zinc-400 hover:border-cyan-300">
                      Imagen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) return;
                          setQuestion(questionIndex, {
                            pendingImageFile: file,
                            localPreviewUrl: URL.createObjectURL(file),
                          });
                        }}
                      />
                    </label>
                    {question.localPreviewUrl || question.imageUrl ? (
                      <img
                        src={question.localPreviewUrl || question.imageUrl || ""}
                        alt=""
                        className="h-28 w-full rounded-md border border-zinc-800 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center rounded-md border border-zinc-800 bg-black/30 px-4 text-sm text-zinc-500">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={optionIndex}
                        className="flex items-center gap-2 rounded-md border border-zinc-800 bg-black/50 p-2"
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-sm"
                          style={{ backgroundColor: ANSWER_COLORS[optionIndex] }}
                        />
                        <input
                          value={option}
                          onChange={(event) => setOption(questionIndex, optionIndex, event.target.value)}
                          placeholder={`Opcion ${optionIndex + 1}`}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Correcta
                      <select
                        value={question.correctIndex}
                        onChange={(event) =>
                          setQuestion(questionIndex, {
                            correctIndex: Number(event.target.value) as AnswerIndex,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
                      >
                        <option value={0}>Roja</option>
                        <option value={1}>Azul</option>
                        <option value={2}>Amarilla</option>
                        <option value={3}>Verde</option>
                      </select>
                    </label>
                    <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Tiempo
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={question.timeLimit}
                        onChange={(event) =>
                          setQuestion(questionIndex, { timeLimit: Number(event.target.value) })
                        }
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={addQuestion}
                className="rounded-md border border-zinc-700 px-5 py-3 text-xs uppercase tracking-[0.22em] text-zinc-200"
              >
                Añadir pregunta
              </button>
              <button
                type="submit"
                disabled={savingQuiz}
                className="rounded-md bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-black transition hover:bg-cyan-200 disabled:opacity-50"
              >
                {savingQuiz ? "Guardando..." : editingQuizId ? "Actualizar" : "Guardar quiz"}
              </button>
            </div>
          </form>

          <aside className="space-y-5">
            <section className="rounded-lg border border-zinc-800 bg-black/50 p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-3xl font-semibold">Quizzes</h2>
                <button
                  type="button"
                  onClick={() => void loadQuizzes()}
                  className="rounded-md border border-zinc-700 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300"
                >
                  {loadingQuizzes ? "..." : "Refrescar"}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {quizzes.map((quiz) => (
                  <button
                    type="button"
                    key={quiz.id}
                    onClick={() => setSelectedQuizId(quiz.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selectedQuizId === quiz.id
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{quiz.title}</p>
                        <p className="text-xs text-zinc-500">
                          {quiz.event || "Sin evento"} · {quiz.questions.length} preguntas
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          editQuiz(quiz);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") editQuiz(quiz);
                        }}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-300"
                      >
                        Editar
                      </span>
                    </div>
                  </button>
                ))}
                {!quizzes.length ? (
                  <p className="rounded-md border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-500">
                    Todavia no hay quizzes guardados.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 md:p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Partida</p>
              <h2 className="mt-1 font-display text-4xl font-semibold">
                {gameId || "Lobby nuevo"}
              </h2>
              {selectedQuiz ? (
                <p className="mt-2 text-sm text-zinc-300">
                  Quiz seleccionado: <span className="text-white">{selectedQuiz.title}</span>
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startGame}
                  disabled={!selectedQuiz || busyAction === "create"}
                  className="rounded-md bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
                >
                  Crear partida
                </button>
                <input
                  value={gameId}
                  onChange={(event) => setGameId(event.target.value.trim())}
                  placeholder="Cargar gameId"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-black/70 px-3 py-3 text-sm"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${activeGameId ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  <span className="text-xs text-zinc-400">
                    {activeGameId ? `Activa: ${activeGameId}` : "Sin partida activa"}
                  </span>
                </div>
                {gameId && gameId !== activeGameId ? (
                  <button
                    type="button"
                    onClick={() => void setActiveGame(gameId)}
                    disabled={busyAction === "active"}
                    className="rounded-md border border-emerald-500/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    Activar esta partida
                  </button>
                ) : null}
                {activeGameId ? (
                  <button
                    type="button"
                    onClick={() => void setActiveGame(null)}
                    disabled={busyAction === "active"}
                    className="rounded-md border border-rose-500/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Desactivar
                  </button>
                ) : null}
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-zinc-800 bg-black/50 p-4 md:p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">
              Control en vivo
            </p>
            <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <h2 className="font-display text-4xl font-semibold">
                {game?.status ?? "Sin partida"}
              </h2>
              {game ? (
                <p className="text-sm text-zinc-400">
                  Pregunta {Math.max(game.currentQuestionIndex + 1, 0)} / {game.totalQuestions}
                </p>
              ) : null}
            </div>

            {game?.status === "question" ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={revealAnswer}
                  disabled={Boolean(busyAction) || correctIndex != null}
                  className="w-full rounded-md border border-cyan-400/60 px-4 py-4 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100 disabled:opacity-40"
                >
                  {correctIndex != null
                    ? "Respuesta revelada ✓"
                    : busyAction === "reveal" ? "Revelando..." : "Revelar respuesta"}
                </button>
              </div>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={goNextQuestion}
                disabled={!game || !selectedQuiz || Boolean(busyAction)}
                className="rounded-md bg-white px-4 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
              >
                Siguiente
              </button>
              <button
                type="button"
                onClick={revealLeaderboard}
                disabled={!game || Boolean(busyAction)}
                className="rounded-md border border-yellow-400/60 px-4 py-4 text-xs uppercase tracking-[0.2em] text-yellow-100 disabled:opacity-40"
              >
                Leaderboard
              </button>
              <button
                type="button"
                onClick={endGame}
                disabled={!game || Boolean(busyAction)}
                className="rounded-md border border-rose-400/60 px-4 py-4 text-xs uppercase tracking-[0.2em] text-rose-100 disabled:opacity-40"
              >
                Finalizar
              </button>
            </div>

            {game?.currentQuestion ? (
              <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Pregunta activa
                </p>
                <h3 className="mt-1 text-2xl font-semibold">{game.currentQuestion.text}</h3>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {game.currentQuestion.options.map((option, index) => (
                    <div
                      key={option}
                      className="rounded-md px-3 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: ANSWER_COLORS[index] }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Respuestas
                </p>
                <p className="text-sm text-zinc-300">
                  {Object.keys(answers).length} / {Object.keys(players).length}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {answerTotals.map((total, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span
                      className="h-5 w-5 rounded-sm"
                      style={{ backgroundColor: ANSWER_COLORS[index] }}
                    />
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Object.keys(answers).length ? (total / Object.keys(answers).length) * 100 : 0}%`,
                          backgroundColor: ANSWER_COLORS[index],
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm text-zinc-300">{total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-black/50 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-lime-300">
                  Lobby y ranking
                </p>
                <h2 className="mt-1 font-display text-4xl font-semibold">
                  {Object.keys(players).length} jugadores
                </h2>
              </div>
              {gameId ? (
                <p className="rounded-md border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-xl text-cyan-200">
                  {gameId}
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Entrando ahora
                </p>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {Object.entries(players).map(([playerId, player]) => (
                    <div
                      key={playerId}
                      className="flex items-center justify-between rounded-md border border-zinc-800 bg-black/40 px-3 py-2"
                    >
                      <span className="truncate text-sm">{player.name}</span>
                      <span className={player.answered ? "text-lime-300" : "text-zinc-500"}>
                        {player.answered ? "OK" : "--"}
                      </span>
                    </div>
                  ))}
                  {!Object.keys(players).length ? (
                    <p className="text-sm text-zinc-500">Esperando jugadores...</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Top actual
                </p>
                <div className="mt-3 space-y-2">
                  {leaderboard.slice(0, 8).map((entry) => (
                    <motion.div
                      key={entry.playerId}
                      layout
                      className="flex items-center justify-between rounded-md border border-zinc-800 bg-black/40 px-3 py-2"
                    >
                      <span className="truncate text-sm">
                        #{entry.rank} {entry.name}
                      </span>
                      <span className="font-mono text-cyan-200">{entry.score}</span>
                    </motion.div>
                  ))}
                  {!leaderboard.length ? (
                    <p className="text-sm text-zinc-500">Sin puntuaciones todavia.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

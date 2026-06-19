"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface PhotoItem {
  id: string;
  originalFileName: string;
  s3Key: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  status: string;
  url?: string;
}

interface UploadTask {
  localId: string;
  file: File;
  progress: number; // 0-100
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const TOKEN_KEY = "tn_photos_admin_token";
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

function authHeaders(token: string): HeadersInit {
  return { "x-admin-token": token };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PhotosAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openLightbox(index: number) { setLightboxIndex(index); }
  function closeLightbox() { setLightboxIndex(null); }
  function prevPhoto() { setLightboxIndex((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null)); }
  function nextPhoto() { setLightboxIndex((i) => (i !== null ? (i + 1) % photos.length : null)); }

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex]);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY) ?? "";
    if (!stored) {
      setAuthLoading(false);
      return;
    }
    setTokenInput(stored);
    void validateToken(stored);
  }, []);

  useEffect(() => {
    if (isAuthed && token) void loadPhotos(token);
  }, [isAuthed, token]);

  async function validateToken(value = tokenInput) {
    setAuthLoading(true);
    setLoginError("");
    try {
      // GET /api/photos exige admin: si responde 200, el token es válido.
      const res = await fetch("/api/photos", {
        headers: authHeaders(value.trim()),
        cache: "no-store",
      });
      if (res.status === 401) throw new Error("Token incorrecto.");
      if (!res.ok && res.status !== 200) throw new Error("No se pudo validar.");
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
    setPhotos([]);
  }

  async function loadPhotos(activeToken = token) {
    setLoadingPhotos(true);
    setError("");
    try {
      const res = await fetch("/api/photos", {
        headers: authHeaders(activeToken),
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudieron cargar las fotos.");
      setPhotos(payload.photos as PhotoItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando fotos.");
    } finally {
      setLoadingPhotos(false);
    }
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED.includes(file.type.toLowerCase())) {
      return "Formato no permitido (JPG, PNG, WEBP, HEIC).";
    }
    if (file.size > MAX_BYTES) {
      return `Demasiado grande (máx ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB).`;
    }
    return null;
  }

  /** Sube un archivo: presign → PUT a S3 → confirm metadata. */
  async function uploadOne(task: UploadTask): Promise<void> {
    const update = (patch: Partial<UploadTask>) =>
      setTasks((prev) => prev.map((t) => (t.localId === task.localId ? { ...t, ...patch } : t)));

    update({ status: "uploading", progress: 5 });

    // 1) Pedir presign al backend
    const presignRes = await fetch("/api/photos/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        fileName: task.file.name,
        mimeType: task.file.type,
        size: task.file.size,
      }),
    });
    const presign = await presignRes.json();
    if (!presignRes.ok) {
      if (presign?.error === "FEATURE_DISABLED") setFeatureDisabled(true);
      throw new Error(presign?.message ?? "No se pudo preparar la subida.");
    }

    // 2) Subir directamente a S3 con XHR para tener progreso real
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.uploadUrl);
      xhr.setRequestHeader("Content-Type", task.file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          update({ progress: 5 + Math.round((e.loaded / e.total) * 85) });
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`S3 respondió ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Error de red subiendo a S3."));
      xhr.send(task.file);
    });

    update({ progress: 95 });

    // 3) Confirmar metadata
    const confirmRes = await fetch("/api/photos/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        id: presign.photoId,
        s3Key: presign.s3Key,
        mimeType: task.file.type,
        size: task.file.size,
        originalFileName: task.file.name,
      }),
    });
    if (!confirmRes.ok) {
      const body = await confirmRes.json().catch(() => ({}));
      throw new Error(body?.message ?? "No se pudo registrar la foto.");
    }

    update({ status: "done", progress: 100 });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError("");
    setMessage("");

    const newTasks: UploadTask[] = [];
    for (const file of Array.from(files)) {
      const err = validateFile(file);
      newTasks.push({
        localId: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: err ? "error" : "pending",
        error: err ?? undefined,
      });
    }
    setTasks((prev) => [...newTasks, ...prev]);

    // Subir secuencialmente los válidos
    for (const task of newTasks) {
      if (task.status === "error") continue;
      try {
        await uploadOne(task);
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) =>
            t.localId === task.localId
              ? { ...t, status: "error", error: err instanceof Error ? err.message : "Error" }
              : t,
          ),
        );
      }
    }

    setMessage("Subida completada.");
    await loadPhotos();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deletePhoto(id: string) {
    if (!window.confirm("¿Eliminar esta foto definitivamente?")) return;
    setError("");
    try {
      const res = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "No se pudo eliminar.");
      }
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando.");
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <main className="min-h-screen bg-techno px-5 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-black/60 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Validando...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-techno px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void validateToken();
          }}
          className="w-full max-w-md rounded-lg border border-zinc-800 bg-black/70 p-6 shadow-2xl"
        >
          <Link href="/" className="font-display text-2xl font-bold tracking-tighter">
            TRIPLE NELSON
          </Link>
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">Fotos · Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">Acceso protegido con el token de admin.</p>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
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
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-display text-sm uppercase tracking-[0.35em] text-zinc-500">
              Triple Nelson
            </Link>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">Gestión de Fotos</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-700 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-400 hover:text-white"
          >
            Salir
          </button>
        </header>

        {featureDisabled ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            La subida de fotos está desactivada globalmente
            (<span className="font-mono">FEATURE_PHOTO_UPLOAD_ENABLED=false</span>). Actívala en las
            variables de entorno para poder subir.
          </p>
        ) : null}
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

        {/* Subida */}
        <section className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Subir fotos</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Selecciona imágenes</h2>
          <p className="mt-2 text-sm text-zinc-300">JPG · PNG · WEBP · HEIC — máx 10 MB por archivo.</p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-cyan-400/50 bg-black/30 px-6 py-10 text-center hover:border-cyan-300">
            <span className="text-sm uppercase tracking-[0.2em] text-cyan-200">
              Pulsa para elegir archivos
            </span>
            <span className="mt-1 text-xs text-zinc-500">o arrástralos aquí</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED.join(",")}
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </label>

          {tasks.length ? (
            <div className="mt-4 space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.localId}
                  className="rounded-md border border-zinc-800 bg-black/40 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-zinc-200">{task.file.name}</span>
                    <span className="shrink-0 text-zinc-500">{formatSize(task.file.size)}</span>
                  </div>
                  {task.status === "error" ? (
                    <p className="mt-1 text-xs text-rose-300">{task.error}</p>
                  ) : (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-[width] ${
                          task.status === "done" ? "bg-emerald-400" : "bg-cyan-300"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Listado */}
        <section className="rounded-lg border border-zinc-800 bg-black/50 p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-lime-300">Galería</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">{photos.length} fotos</h2>
            </div>
            <button
              type="button"
              onClick={() => void loadPhotos()}
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300"
            >
              {loadingPhotos ? "..." : "Refrescar"}
            </button>
          </div>

          {photos.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 cursor-pointer"
                  onClick={() => openLightbox(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.originalFileName}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 px-3 py-2 opacity-0 transition group-hover:opacity-100">
                    <span className="truncate text-xs text-zinc-300">{photo.originalFileName}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void deletePhoto(photo.id); }}
                      className="shrink-0 rounded border border-rose-500/50 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-rose-200 hover:bg-rose-500/20"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-500">
              Todavía no hay fotos subidas.
            </p>
          )}
        </section>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (() => {
        const photo = photos[lightboxIndex];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
            onClick={closeLightbox}
          >
            {/* Imagen */}
            <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.originalFileName}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              />

              {/* Barra inferior */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 rounded-b-lg bg-black/70 px-4 py-3 backdrop-blur-sm">
                <span className="truncate text-xs text-zinc-300">{photo.originalFileName}</span>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={photo.url}
                    download={photo.originalFileName}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border border-cyan-500/50 px-3 py-1.5 text-[10px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Descargar
                  </a>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void deletePhoto(photo.id).then(closeLightbox); }}
                    className="rounded border border-rose-500/50 px-3 py-1.5 text-[10px] uppercase tracking-widest text-rose-300 hover:bg-rose-500/20"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              {/* Contador */}
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-400">
                {lightboxIndex + 1} / {photos.length}
              </div>
            </div>

            {/* Flechas */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/90"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/90"
                >
                  ›
                </button>
              </>
            )}

            {/* Cerrar */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-sm text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        );
      })()}
    </main>
  );
}

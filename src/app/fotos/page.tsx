"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface GalleryPhoto {
  id: string;
  url: string;
  createdAt: string;
  originalFileName: string;
}

interface UploadTask {
  localId: string;
  name: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

export default function GalleryPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Selección múltiple para descarga en lote
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/photos/gallery", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo cargar la galería.");
      setEnabled(Boolean(payload.enabled));
      setPhotos((payload.photos as GalleryPhoto[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando la galería.");
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  // ─── Subida ─────────────────────────────────────────────────────────────────

  function isHeic(file: File): boolean {
    const t = file.type.toLowerCase();
    if (t === "image/heic" || t === "image/heif") return true;
    // iOS a veces no rellena el MIME → detectar por extensión
    return /\.hei[cf]$/i.test(file.name);
  }

  /**
   * Convierte HEIC/HEIF a JPG en el navegador para que la foto se vea en
   * cualquier dispositivo (Android/desktop no renderizan HEIC). Si falla,
   * devolvemos el original y dejamos que el backend decida.
   */
  async function maybeConvertHeic(file: File): Promise<File> {
    if (!isHeic(file)) return file;
    try {
      const heic2any = (await import("heic2any")).default;
      const blob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 })) as Blob;
      const newName = file.name.replace(/\.hei[cf]$/i, ".jpg");
      return new File([blob], newName, { type: "image/jpeg" });
    } catch {
      return file; // fallback: subir tal cual
    }
  }

  function validateFile(file: File): string | null {
    const t = file.type.toLowerCase();
    // Aceptamos HEIC aquí porque se convertirá a JPG antes de subir.
    const okType = ALLOWED.includes(t) || isHeic(file);
    if (!okType) return "Formato no permitido.";
    if (file.size > MAX_BYTES) return `Supera ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.`;
    return null;
  }

  async function uploadOne(file: File, localId: string): Promise<void> {
    const update = (patch: Partial<UploadTask>) =>
      setTasks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));

    update({ status: "uploading", progress: 5 });

    // Subida pública: presign sin token (el backend permite "attendee").
    const presignRes = await fetch("/api/photos/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
    });
    const presign = await presignRes.json();
    if (!presignRes.ok) throw new Error(presign?.message ?? "No se pudo preparar la subida.");

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update({ progress: 5 + Math.round((e.loaded / e.total) * 85) });
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Error de red."));
      xhr.send(file);
    });

    update({ progress: 95 });

    const confirmRes = await fetch("/api/photos/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: presign.photoId,
        s3Key: presign.s3Key,
        mimeType: file.type,
        size: file.size,
        originalFileName: file.name,
      }),
    });
    if (!confirmRes.ok) {
      const body = await confirmRes.json().catch(() => ({}));
      throw new Error(body?.message ?? "No se pudo registrar.");
    }

    update({ status: "done", progress: 100 });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setError("");

    const newTasks: UploadTask[] = Array.from(files).map((file) => {
      const err = validateFile(file);
      return {
        localId: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        progress: 0,
        status: err ? "error" : "pending",
        error: err ?? undefined,
      };
    });
    setTasks(newTasks);

    const fileArray = Array.from(files);
    for (let i = 0; i < fileArray.length; i += 1) {
      const task = newTasks[i];
      if (task.status === "error") continue;
      try {
        // Convertir HEIC→JPG en el móvil antes de subir (si aplica).
        const prepared = await maybeConvertHeic(fileArray[i]);
        await uploadOne(prepared, task.localId);
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

    setUploading(false);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    await loadPhotos();
    // Limpiar tasks completadas tras un momento
    setTimeout(() => setTasks([]), 2500);
  }

  // ─── Descarga ────────────────────────────────────────────────────────────────

  async function downloadPhoto(photo: GalleryPhoto) {
    try {
      // fetch + blob fuerza descarga en lugar de abrir en el navegador
      const res = await fetch(photo.url, { mode: "cors" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = photo.originalFileName || `triplenelson-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: abrir en pestaña nueva si CORS bloquea el blob
      window.open(photo.url, "_blank");
    }
  }

  async function downloadSelected() {
    const toDownload = photos.filter((p) => selected.has(p.id));
    // Descargas individuales secuenciales (más amigable en móvil que un ZIP).
    for (const photo of toDownload) {
      await downloadPhoto(photo);
      await new Promise((r) => setTimeout(r, 400)); // evita que el navegador bloquee la ráfaga
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Lightbox: navegación con teclado ────────────────────────────────────────

  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, showPrev, showNext]);

  // Swipe táctil en el lightbox
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) showPrev();
      else showNext();
    }
    touchStartX.current = null;
  }

  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-techno">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="font-display text-lg font-bold tracking-tighter transition-colors hover:text-zinc-300">
            TRIPLE NELSON
          </Link>
          <div className="flex items-center gap-3">
            {photos.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectMode((s) => !s);
                  setSelected(new Set());
                }}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 hover:text-white"
              >
                {selectMode ? "Cancelar" : "Seleccionar"}
              </button>
            ) : null}
            <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 transition-colors hover:text-white">
              Volver
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 lg:px-8">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.36em] text-zinc-500">Galería compartida</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tighter md:text-6xl">FOTOS</h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">
            Sube tus fotos del evento y míralas junto a las de todos. Pulsa una para ampliarla.
          </p>
        </div>

        {/* Zona de subida (solo si la feature está activa) — móvil-first */}
        {enabled ? (
          <section className="mb-8">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Galería: en iOS/Android abre el selector de fotos nativo.
                  accept="image/*" + extensiones HEIC para fotos de iPhone. */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/5 px-4 py-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/10 active:scale-[0.98]">
                <span className="text-2xl">🖼️</span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:text-sm">
                  {uploading ? "Subiendo..." : "Desde galería"}
                </span>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </label>

              {/* Cámara: capture abre directamente la cámara trasera en móvil. */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/5 px-4 py-6 text-center transition hover:border-fuchsia-300 hover:bg-fuchsia-400/10 active:scale-[0.98]">
                <span className="text-2xl">📸</span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-200 sm:text-sm">
                  Hacer foto
                </span>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-500">JPG · PNG · WEBP · HEIC — máx 10 MB</p>

            {tasks.length ? (
              <div className="mt-3 space-y-2">
                {tasks.map((task) => (
                  <div key={task.localId} className="rounded-md border border-zinc-800 bg-black/40 px-4 py-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-zinc-300">{task.name}</span>
                      <span className="shrink-0 text-zinc-500">
                        {task.status === "done" ? "✓" : task.status === "error" ? "✗" : `${task.progress}%`}
                      </span>
                    </div>
                    {task.status === "error" ? (
                      <p className="mt-1 text-[11px] text-rose-300">{task.error}</p>
                    ) : (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-[width] ${task.status === "done" ? "bg-emerald-400" : "bg-cyan-300"}`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : enabled === false ? (
          <p className="mb-8 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            La galería compartida no está disponible todavía. Vuelve pronto.
          </p>
        ) : null}

        {error ? (
          <p className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {/* Grid de thumbnails */}
        {loading ? (
          <p className="text-sm text-zinc-500">Cargando galería...</p>
        ) : photos.length ? (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:gap-1.5">
            {photos.map((photo, index) => {
              const isSelected = selected.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-zinc-900"
                  onClick={() => (selectMode ? toggleSelect(photo.id) : setLightboxIndex(index))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.originalFileName}
                    loading="lazy"
                    className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                      selectMode && !isSelected ? "opacity-60" : ""
                    }`}
                  />
                  {selectMode ? (
                    <div
                      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        isSelected ? "border-cyan-300 bg-cyan-300 text-black" : "border-white/70 bg-black/40 text-transparent"
                      }`}
                    >
                      ✓
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : enabled ? (
          <div className="rounded-xl border border-zinc-800 bg-black/30 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-zinc-300">Todavía no hay fotos</p>
            <p className="mt-2 text-sm text-zinc-500">¡Sé el primero en subir tus fotos del evento!</p>
          </div>
        ) : null}
      </main>

      {/* Barra de acción de selección */}
      {selectMode && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/90 px-5 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <span className="text-sm text-zinc-300">{selected.size} seleccionadas</span>
            <button
              type="button"
              onClick={() => void downloadSelected()}
              className="rounded-md bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-cyan-200"
            >
              Descargar
            </button>
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightboxPhoto ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs text-zinc-400">
              {(lightboxIndex ?? 0) + 1} / {photos.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadPhoto(lightboxPhoto)}
                className="rounded-md border border-zinc-600 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white hover:bg-white/10"
              >
                Descargar
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="rounded-md border border-zinc-600 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white hover:bg-white/10"
              >
                Cerrar ✕
              </button>
            </div>
          </div>

          {/* Imagen + flechas */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-6">
            {photos.length > 1 ? (
              <button
                type="button"
                onClick={showPrev}
                className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70 md:left-6"
                aria-label="Anterior"
              >
                ‹
              </button>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lightboxPhoto.id}
              src={lightboxPhoto.url}
              alt={lightboxPhoto.originalFileName}
              className="max-h-full max-w-full object-contain"
            />

            {photos.length > 1 ? (
              <button
                type="button"
                onClick={showNext}
                className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70 md:right-6"
                aria-label="Siguiente"
              >
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";

function previewSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Published = { id: string; slug: string };

export function NewReportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState<Published | null>(null);

  const slug = slugOverride ? previewSlug(slugOverride) : previewSlug(title);

  async function handleFile(file: File) {
    const text = await file.text();
    setHtml(text);
    setFileName(file.name);
    setFileSize(file.size);
    if (!title) {
      setTitle(file.name.replace(/\.html?$/i, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!html.trim()) {
      setError("Subí un archivo .html o pegá el contenido");
      return;
    }

    setPending(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        html,
        slug: slugOverride || undefined,
        allowComments,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error || "No se pudo subir el reporte");
      return;
    }

    setPublished({ id: data.id, slug: data.slug });
  }

  function reset() {
    setTitle("");
    setDescription("");
    setSlugOverride("");
    setHtml("");
    setFileName(null);
    setFileSize(0);
    setShowPreview(false);
    setPublished(null);
  }

  if (published) {
    return (
      <section className="panel result">
        <div className="tag">
          <span className="d" />
          Link listo para entregar
        </div>
        <a
          href={`/r/${published.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="url"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}/r/{published.slug}
        </a>
        <div className="btn-row">
          <CopyLinkButton path={`/r/${published.slug}`} gold />
          <a href={`/r/${published.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            Abrir página
          </a>
          <Link href={`/reports/${published.id}`} className="btn btn-quiet">
            Editar detalles
          </Link>
          <button type="button" onClick={reset} className="btn btn-quiet">
            Subir otro
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" id="uploader">
      <form onSubmit={handleSubmit}>
        {fileName ? (
          <div className="file-pill">
            <span className="fi">HTML</span>
            <div>
              <div className="fn">{fileName}</div>
              <div className="fs">{formatSize(fileSize)}</div>
            </div>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <label
            className={`drop${dragOver ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <span className="ico">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M6 10l6-6 6 6" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
            </span>
            <span className="t">Arrastrá aquí tu .html</span>
            <span className="s">o hacé clic para elegirlo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        )}

        <details style={{ marginTop: 14, fontSize: "0.85rem" }}>
          <summary className="mono-label" style={{ cursor: "pointer" }}>
            O pegá el HTML directamente
          </summary>
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setFileSize(new Blob([e.target.value]).size);
            }}
            rows={8}
            placeholder="<!doctype html>..."
            className="input"
            style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: "0.78rem" }}
          />
        </details>

        <div className="fields">
          <div className="field">
            <label className="mono-label" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="field">
            <label className="mono-label" htmlFor="description">
              Descripción (opcional)
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              style={{ marginTop: 8 }}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label className="mono-label" htmlFor="slug">
            Link
          </label>
          <div className="slug-box" style={{ marginTop: 8 }}>
            <span className="pre">/r/</span>
            <input
              id="slug"
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder={slug || "se genera del título"}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
            />
          </div>
          <div className="hint">Solo minúsculas, números y guiones.</div>
        </div>

        <label className="replace" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
          />
          Permitir comentarios (cualquiera con el link podrá comentar sobre el reporte)
        </label>

        {html && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="btn btn-ghost btn-sm"
            >
              {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
            </button>
            {showPreview && (
              <iframe
                srcDoc={html}
                sandbox=""
                style={{ marginTop: 10, height: 384, width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}
              />
            )}
          </div>
        )}

        {error && <div className="err">{error}</div>}

        <div className="actions">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Subiendo..." : "Publicar reporte"}
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";

type Props = {
  id: string;
  initialTitle: string;
  initialDescription: string;
  initialSlug: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EditReportForm({ id, initialTitle, initialDescription, initialSlug }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [slug, setSlug] = useState(initialSlug);
  const [newHtml, setNewHtml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleFile(file: File) {
    const text = await file.text();
    setNewHtml(text);
    setFileName(file.name);
    setFileSize(file.size);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const body: Record<string, string> = { title, description };
    if (slug !== initialSlug) body.slug = slug;
    if (newHtml) body.html = newHtml;

    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error || "No se pudo guardar");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar este reporte? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("No se pudo eliminar");
    }
  }

  return (
    <section className="panel">
      <div
        className="row"
        style={{ gridTemplateColumns: "1fr auto", marginBottom: 22, padding: "14px 16px" }}
      >
        <a href={`/r/${initialSlug}`} target="_blank" rel="noopener noreferrer" className="u" style={{ marginTop: 0 }}>
          /r/{initialSlug}
        </a>
        <CopyLinkButton path={`/r/${initialSlug}`} gold />
      </div>

      <form onSubmit={handleSubmit}>
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
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
            />
          </div>
          {slug !== initialSlug && (
            <div className="hint warn">Ojo: si cambiás el link, el anterior deja de funcionar.</div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          {fileName ? (
            <div className="file-pill">
              <span className="fi">HTML</span>
              <div>
                <div className="fn">{fileName}</div>
                <div className="fs">{formatSize(fileSize)} · nueva versión</div>
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
              style={{ padding: "26px 22px" }}
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
              <span className="t" style={{ fontSize: "0.95rem" }}>
                Reemplazar contenido (opcional)
              </span>
              <span className="s">arrastrá el nuevo .html acá, o hacé clic</span>
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
        </div>

        {newHtml && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="btn btn-ghost btn-sm"
            >
              {showPreview ? "Ocultar vista previa" : "Ver vista previa de la nueva versión"}
            </button>
            {showPreview && (
              <iframe
                srcDoc={newHtml}
                sandbox=""
                style={{ marginTop: 10, height: 384, width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}
              />
            )}
          </div>
        )}

        {error && <div className="err">{error}</div>}

        <div className="actions" style={{ justifyContent: "space-between" }}>
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-sm">
            {deleting ? "Eliminando..." : "Eliminar reporte"}
          </button>
        </div>
      </form>
    </section>
  );
}

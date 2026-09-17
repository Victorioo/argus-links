"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export type CommentItem = {
  id: string;
  selector: string;
  authorName: string;
  text: string;
  createdAt: string;
};

type Props = {
  id: string;
  initialTitle: string;
  initialDescription: string;
  initialSlug: string;
  initialAllowComments: boolean;
  initialComments: CommentItem[];
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EditReportForm({
  id,
  initialTitle,
  initialDescription,
  initialSlug,
  initialAllowComments,
  initialComments,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [slug, setSlug] = useState(initialSlug);
  const [allowComments, setAllowComments] = useState(initialAllowComments);
  const [comments, setComments] = useState(initialComments);
  const [newHtml, setNewHtml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  async function handleDeleteComment(commentId: string) {
    setDeletingCommentId(commentId);
    const res = await fetch(`/api/comments/${slug}/${commentId}`, { method: "DELETE" });
    setDeletingCommentId(null);
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

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

    const body: Record<string, string | boolean> = { title, description, allowComments };
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

        <label className="replace" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={allowComments}
            onChange={(e) => setAllowComments(e.target.checked)}
          />
          Permitir comentarios (cualquiera con el link podrá comentar sobre el reporte)
        </label>

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

      {initialAllowComments && (
        <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 22 }}>
          <h2 style={{ marginBottom: 14 }}>Comentarios ({comments.length})</h2>
          {comments.length === 0 ? (
            <div className="empty">Todavía no recibiste comentarios en este reporte.</div>
          ) : (
            <div className="rows">
              {comments.map((c) => (
                <div key={c.id} className="row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div className="client" style={{ fontSize: "0.9rem" }}>
                      {c.authorName}
                    </div>
                    <div className="desc">{c.text}</div>
                    <div className="meta">
                      <span>{new Date(c.createdAt).toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                  <div className="btns">
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      disabled={deletingCommentId === c.id}
                      className="btn btn-danger btn-sm"
                    >
                      {deletingCommentId === c.id ? "Borrando..." : "Borrar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

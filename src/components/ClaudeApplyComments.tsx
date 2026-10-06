"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClaudeLogo, ClaudeMark } from "@/components/ClaudeLogo";
import { Spotlight } from "@/components/Spotlight";
import { BELL_TOUR_KEY, CLAUDE_TOUR_KEY } from "@/components/tours";

export type AiComment = {
  id: string;
  authorName: string;
  text: string;
  replyCount: number;
};

type Applied = { commentIds: string[]; find: string; replace: string };
type AiResult = {
  html: string;
  changed: boolean;
  summary: string;
  applied: Applied[];
  failed: { commentIds: string[]; reason: string }[];
  skipped: { commentId: string; reason: string }[];
  newExternalHosts: string[];
  remainingToday: number;
};

function clip(s: string, n = 400) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// The preview runs in a sandboxed iframe without same-origin access, so
// scripts in the proposed HTML can never touch the signed-in session.
function previewDoc(html: string, slug: string) {
  if (/<base[\s>]/i.test(html)) return html;
  const base = `<base href="/r/${slug}/">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${html}`;
}

export function ClaudeApplyComments({
  reportId,
  slug,
  comments,
}: {
  reportId: string;
  slug: string;
  comments: AiComment[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(comments.map((c) => c.id));
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [deleteApplied, setDeleteApplied] = useState(false);
  const [published, setPublished] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const [showTour, setShowTour] = useState(false);

  // One-time "what is new" spotlight. Only after the bell tour was seen, so two
  // tours never stack; if storage is unavailable it is skipped.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (localStorage.getItem(CLAUDE_TOUR_KEY) || !localStorage.getItem(BELL_TOUR_KEY)) return;
        headRef.current?.scrollIntoView({ block: "center" });
        setShowTour(true);
      } catch {
        // sin localStorage no se muestra
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const endTour = useCallback(() => {
    setShowTour(false);
    try {
      localStorage.setItem(CLAUDE_TOUR_KEY, "1");
    } catch {
      // ignorar
    }
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function run() {
    setError(null);
    setResult(null);
    setPublished(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/ai-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds: selected, instructions: instructions || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo consultar a Claude");
        return;
      }
      setResult(data);
    } catch {
      setError("No se pudo consultar a Claude. Revisá tu conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!result) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: result.html }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo publicar los cambios");
        return;
      }
      if (deleteApplied) {
        const ids = [...new Set(result.applied.flatMap((a) => a.commentIds))];
        await Promise.all(
          ids.map((cid) => fetch(`/api/comments/${slug}/${cid}`, { method: "DELETE" }).catch(() => {})),
        );
      }
      setPublished(true);
      setResult(null);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const commentText = (id: string) => {
    const c = comments.find((x) => x.id === id);
    return c ? `${c.authorName}: ${clip(c.text, 80)}` : id;
  };

  return (
    <section className="claude-card" style={{ maxWidth: 720, margin: "0 auto 24px" }}>
      <div ref={headRef}>
        <div className="claude-brand">
          <ClaudeLogo height={26} />
        </div>
        <h2>Aplicar comentarios con Claude</h2>
      </div>
      {showTour && (
        <Spotlight
          target={headRef}
          shape="rect"
          title="Aplicá los comentarios con Claude"
          text="Ahora Claude puede leer los comentarios de tu reporte y proponer los cambios por vos. Elegí cuáles aplicar y revisá la vista previa antes de publicar."
          onDone={endTour}
        />
      )}
      <p className="claude-lead">
        Elegí qué comentarios aplicar y Claude propone los cambios en el reporte. Antes de publicar vas a
        ver una vista previa: nada se guarda hasta que lo confirmes.
      </p>

      {published && (
        <div className="hint ok" style={{ marginBottom: 14 }}>
          Cambios publicados. El link del reporte sigue siendo el mismo.{" "}
          <a href={`/r/${slug}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            Ver reporte
          </a>
        </div>
      )}

      {!result && (
        <>
          <div className="mono-label" style={{ marginBottom: 8 }}>
            Comentarios de la página principal ({selected.length}/{comments.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            {comments.map((c) => (
              <label key={c.id} className="replace" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <b>{c.authorName}</b>: {clip(c.text, 220)}
                  {c.replyCount > 0 && (
                    <span style={{ opacity: 0.7 }}>
                      {" "}
                      · {c.replyCount} {c.replyCount === 1 ? "respuesta" : "respuestas"}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          <label className="mono-label" htmlFor="ai-extra" style={{ display: "block", marginTop: 16 }}>
            Indicaciones extra (opcional)
          </label>
          <textarea
            id="ai-extra"
            className="input"
            rows={2}
            maxLength={1000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Por ejemplo: mantené el tono formal y no cambies los números."
            style={{ marginTop: 8 }}
          />

          {error && <div className="err">{error}</div>}

          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || selected.length === 0}
            onClick={run}
            style={{ marginTop: 14 }}
          >
            <ClaudeMark size={16} />
            {loading ? "Claude está trabajando…" : "Aplicar con Claude"}
          </button>
          {loading && <p className="hint" style={{ marginTop: 10 }}>Puede tardar uno o dos minutos. No cierres esta página.</p>}
        </>
      )}

      {result && (
        <div>
          {result.summary && (
            <div className="hint ok" style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>
              {result.summary}
            </div>
          )}

          {result.newExternalHosts.length > 0 && (
            <div className="hint warn" style={{ marginBottom: 14 }}>
              Atención: los cambios agregan referencias a sitios externos que el reporte no tenía antes:{" "}
              <b>{result.newExternalHosts.join(", ")}</b>. Revisalo bien antes de publicar.
            </div>
          )}

          {result.skipped.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="mono-label" style={{ marginBottom: 6 }}>No aplicados por Claude</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem" }}>
                {result.skipped.map((s) => (
                  <li key={s.commentId}>
                    {commentText(s.commentId)} — <i>{s.reason}</i>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="mono-label" style={{ marginBottom: 6 }}>No se pudieron aplicar</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem" }}>
                {result.failed.map((f, i) => (
                  <li key={i}>
                    {f.commentIds.map(commentText).join(" · ") || "Cambio"} — <i>{f.reason}</i>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!result.changed ? (
            <p>Claude no encontró cambios para aplicar con los comentarios elegidos.</p>
          ) : (
            <>
              <div className="mono-label" style={{ marginBottom: 8 }}>
                Vista previa con los cambios ({result.applied.length}{" "}
                {result.applied.length === 1 ? "cambio" : "cambios"})
              </div>
              <iframe
                title="Vista previa"
                sandbox="allow-scripts"
                srcDoc={previewDoc(result.html, slug)}
                style={{ width: "100%", height: 460, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}
              />

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: "0.88rem" }}>Ver los cambios en detalle</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {result.applied.map((a, i) => (
                    <div key={i} style={{ fontSize: "0.8rem" }}>
                      <div style={{ opacity: 0.75, marginBottom: 4 }}>
                        {a.commentIds.map(commentText).join(" · ")}
                      </div>
                      <pre style={{ margin: 0, padding: 8, borderRadius: 8, background: "rgba(220,60,60,.12)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        − {clip(a.find)}
                      </pre>
                      <pre style={{ margin: "4px 0 0", padding: 8, borderRadius: 8, background: "rgba(60,180,100,.12)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        + {clip(a.replace)}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>

              <label className="replace" style={{ marginTop: 14 }}>
                <input type="checkbox" checked={deleteApplied} onChange={(e) => setDeleteApplied(e.target.checked)} />
                Borrar los comentarios aplicados al publicar
              </label>
            </>
          )}

          {error && <div className="err">{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {result.changed && (
              <button type="button" className="btn btn-primary" disabled={publishing} onClick={publish}>
                {publishing ? "Publicando…" : "Publicar cambios"}
              </button>
            )}
            <button type="button" className="btn btn-quiet" disabled={publishing} onClick={() => setResult(null)}>
              {result.changed ? "Descartar" : "Volver"}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            {result.remainingToday === 1 ? "Te queda 1 uso de Claude hoy." : `Te quedan ${result.remainingToday} usos de Claude hoy.`}
          </p>
        </div>
      )}
    </section>
  );
}

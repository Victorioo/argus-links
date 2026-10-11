"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = { id: string; slug: string; title: string; createdAt: string };

type Status = "idle" | "analyzing" | "ready" | "error" | "saving" | "saved";

type Row = {
  client: string;
  period: string;
  internal: boolean;
  include: boolean;
  status: Status;
  error?: string;
};

const CONCURRENCY = 3;

const emptyRow = (): Row => ({ client: "", period: "", internal: false, include: false, status: "idle" });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export function ClassifyReports({
  reports: initialReports,
  knownClients,
  aiEnabled,
}: {
  reports: Item[];
  knownClients: string[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  // The server list shrinks as reports get classified; keep the one the person is working on.
  const [reports] = useState(initialReports);
  const listId = useId();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(reports.map((r) => [r.id, emptyRow()])),
  );
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const stopRef = useRef(false);

  const patch = (id: string, change: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const analyzed = Object.values(rows).filter((r) => r.status === "ready" || r.status === "saved").length;
  const toSave = Object.values(rows).filter(
    (r) => r.include && r.status !== "saved" && (r.client.trim() || r.internal),
  ).length;
  const saved = Object.values(rows).filter((r) => r.status === "saved").length;

  async function analyzeOne(id: string) {
    patch(id, { status: "analyzing", error: undefined });
    try {
      const res = await fetch(`/api/reports/${id}/classify`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patch(id, { status: "error", error: data.error || "No se pudo analizar" });
        // A daily limit or a missing key applies to every report: stop instead of failing 40 times.
        return res.status === 429 || res.status === 503 ? (data.error as string) : null;
      }
      patch(id, {
        status: "ready",
        client: data.client ?? "",
        period: data.period ?? "",
        internal: !!data.internal,
        include: !!(data.client || data.internal),
      });
    } catch {
      patch(id, { status: "error", error: "Error de conexión" });
    }
    return null;
  }

  // The same client can come back as "Coded", "Coded STEAM League AI" or
  // "A Tax Solution" / "A Tax Solutions" across reports. Group the variants and
  // settle on the shortest, brand-level spelling (the one the team uses in links).
  function unifyClientNames() {
    setRows((prev) => {
      const norm = (name: string) => key(name).replace(/s$/, "");
      const keys = [...new Set(Object.values(prev).map((r) => r.client.trim()).filter(Boolean).map(norm))].sort(
        (a, b) => a.length - b.length,
      );
      // A name belongs to the shortest other name it starts with (min. 4 letters).
      const base = (k: string) => keys.find((short) => short.length >= 4 && k.startsWith(short)) ?? k;

      const spellings = new Map<string, Map<string, number>>();
      for (const r of Object.values(prev)) {
        const name = r.client.trim();
        if (!name || norm(name) !== base(norm(name))) continue;
        const counts = spellings.get(norm(name)) ?? new Map<string, number>();
        counts.set(name, (counts.get(name) ?? 0) + 1);
        spellings.set(norm(name), counts);
      }
      const best = (k: string) => [...(spellings.get(k)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];

      const next: Record<string, Row> = {};
      for (const [id, r] of Object.entries(prev)) {
        const name = r.client.trim();
        next[id] = name ? { ...r, client: best(base(norm(name))) ?? name } : r;
      }
      return next;
    });
  }

  async function analyzeAll() {
    stopRef.current = false;
    setRunning(true);
    setNote(null);
    const queue = reports.map((r) => r.id).filter((id) => rows[id].status === "idle" || rows[id].status === "error");
    let stopReason: string | null = null;

    async function worker() {
      while (queue.length && !stopRef.current) {
        const id = queue.shift()!;
        const reason = await analyzeOne(id);
        if (reason) {
          stopReason = reason;
          stopRef.current = true;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    unifyClientNames();
    setRunning(false);
    setNote(stopReason);
  }

  async function saveSelected() {
    setSaving(true);
    setNote(null);
    setSuccess(null);
    let failed = 0;
    let ok = 0;
    for (const item of reports) {
      const row = rows[item.id];
      if (!row.include || row.status === "saved" || !(row.client.trim() || row.internal)) continue;
      patch(item.id, { status: "saving" });
      const res = await fetch(`/api/reports/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: row.client.trim(), period: row.period.trim(), internal: row.internal }),
      }).catch(() => null);
      if (res?.ok) {
        patch(item.id, { status: "saved", include: false });
        ok++;
      } else {
        failed++;
        patch(item.id, { status: "error", error: "No se pudo guardar" });
      }
    }
    setSaving(false);
    if (failed) setNote(`${failed} no se pudieron guardar. Reintentá.`);
    if (ok) setSuccess(`Listo: ${ok} ${ok === 1 ? "reporte guardado" : "reportes guardados"}.`);
    router.refresh();
  }

  if (!reports.length) {
    return (
      <div className="empty">
        No quedan reportes sin clasificar. <Link href="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <section className="list" style={{ marginTop: 28 }}>
      <div className="classify-bar">
        <div>
          <b>{reports.length - saved}</b> sin clasificar
          {analyzed > 0 && <span className="classify-sub"> · {analyzed} analizados</span>}
          {saved > 0 && <span className="classify-sub"> · {saved} guardados</span>}
        </div>
        <div className="classify-actions">
          {aiEnabled ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={analyzeAll} disabled={running || saving}>
              {running ? "Claude está analizando…" : analyzed ? "Analizar los que faltan" : "Analizar con Claude"}
            </button>
          ) : (
            <span className="classify-sub">Claude no está configurado: completá a mano.</span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveSelected}
            disabled={running || saving || toSave === 0}
          >
            {saving ? "Guardando…" : `Guardar ${toSave} seleccionado${toSave === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
      {note && <div className="ai-note err">{note}</div>}
      {success && (
        <div className="ai-note">
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
          <Link href="/" className="btn btn-quiet btn-sm">
            Ver en el inicio
          </Link>
        </div>
      )}

      <datalist id={listId}>
        {knownClients.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="rows">
        {reports.map((item) => {
          const row = rows[item.id];
          const locked = row.status === "saved" || row.status === "saving";
          return (
            <div key={item.id} className={`row classify-row${row.status === "saved" ? " done" : ""}`}>
              <label className="replace" aria-label="Incluir al guardar">
                <input
                  type="checkbox"
                  checked={row.include}
                  disabled={locked}
                  onChange={(e) => patch(item.id, { include: e.target.checked })}
                />
              </label>
              <div className="classify-main">
                <a href={`/r/${item.slug}`} target="_blank" rel="noopener noreferrer" className="client">
                  {item.title}
                </a>
                <div className="meta">
                  <span>{formatDate(item.createdAt)}</span>
                  {row.status === "analyzing" && <span className="classify-state">analizando…</span>}
                  {row.status === "saved" && <span className="classify-state ok">guardado</span>}
                  {row.status === "error" && <span className="classify-state bad">{row.error}</span>}
                </div>
              </div>
              <div className="classify-fields">
                <input
                  type="text"
                  className="input"
                  placeholder="Cliente"
                  aria-label="Cliente"
                  list={listId}
                  maxLength={100}
                  value={row.client}
                  disabled={locked}
                  onChange={(e) => patch(item.id, { client: e.target.value, include: true })}
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Período"
                  aria-label="Período"
                  maxLength={60}
                  value={row.period}
                  disabled={locked}
                  onChange={(e) => patch(item.id, { period: e.target.value })}
                />
                <label className="replace">
                  <input
                    type="checkbox"
                    checked={row.internal}
                    disabled={locked}
                    onChange={(e) => patch(item.id, { internal: e.target.checked, include: true })}
                  />
                  Interno
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

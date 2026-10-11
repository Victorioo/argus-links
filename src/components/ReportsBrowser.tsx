"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PencilIcon } from "@/components/Icons";

export type ReportListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  client: string | null;
  period: string | null;
  pendingComments: number;
  views: number;
  createdAt: string;
  createdByName: string;
  visibility: "PUBLIC" | "PASSWORD" | "RESTRICTED";
};

const NO_CLIENT = "Sin cliente";
const ALL = "";

function visibilityLabel(v: ReportListItem["visibility"]) {
  if (v === "PASSWORD") return "🔒 Con contraseña";
  if (v === "RESTRICTED") return "👥 Restringido";
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ReportsBrowser({ reports }: { reports: ReportListItem[] }) {
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [clientFilter, setClientFilter] = useState(ALL);

  const pendingTotal = useMemo(
    () => reports.filter((r) => r.pendingComments > 0).length,
    [reports],
  );

  const clientOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reports) {
      const key = r.client?.trim() || NO_CLIENT;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => {
      if (a === NO_CLIENT) return 1;
      if (b === NO_CLIENT) return -1;
      return a.localeCompare(b, "es");
    });
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (onlyPending && r.pendingComments === 0) return false;
      if (clientFilter !== ALL && (r.client?.trim() || NO_CLIENT) !== clientFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.client?.toLowerCase().includes(q) ||
        r.period?.toLowerCase().includes(q) ||
        r.createdByName.toLowerCase().includes(q)
      );
    });
  }, [reports, query, onlyPending, clientFilter]);

  return (
    <section className="list">
      <div className="list-head">
        <h2>Reportes publicados</h2>
        <span className="chip v">{reports.length}</span>
      </div>

      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Buscar reporte, cliente o autor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input toolbar-search"
        />
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filtrar por cliente"
          className="input client-select"
        >
          <option value={ALL}>Todos los clientes</option>
          {clientOptions.map(([name, count]) => (
            <option key={name} value={name}>
              {name} ({count})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyPending((v) => !v)}
          aria-pressed={onlyPending}
          className={`toolbar-toggle${onlyPending ? " on" : ""}`}
        >
          Pendientes ({pendingTotal})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {reports.length === 0
            ? "Todavía no hay reportes. Subí el primero."
            : "No se encontraron reportes con ese criterio."}
        </div>
      ) : (
        <div className="rows">
          {filtered.map((r) => (
            <div key={r.id} className="row">
              <div>
                <a
                  href={`/r/${r.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="client"
                >
                  {r.title}
                </a>
                <div className="tags">
                  {clientFilter === ALL && r.client && <span className="chip">{r.client}</span>}
                  {r.period && <span className="chip v">{r.period}</span>}
                  {r.pendingComments > 0 && (
                    <Link href={`/reports/${r.id}`} className="chip chip-pending">
                      {r.pendingComments} sin resolver
                    </Link>
                  )}
                  {visibilityLabel(r.visibility) && (
                    <span className="chip">{visibilityLabel(r.visibility)}</span>
                  )}
                </div>
                {r.description && <div className="desc">{r.description}</div>}
                <div className="meta">
                  <span>{r.createdByName}</span>
                  <span>{formatDate(r.createdAt)}</span>
                  <span>{r.views} vistas</span>
                </div>
              </div>
              <div className="btns">
                <CopyLinkButton path={`/r/${r.slug}`} iconOnly />
                <Link
                  href={`/reports/${r.id}`}
                  className="btn btn-quiet btn-sm btn-icon"
                  title="Editar"
                  aria-label="Editar"
                >
                  <PencilIcon />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

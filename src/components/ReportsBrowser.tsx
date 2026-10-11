"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PencilIcon, UploadIcon } from "@/components/Icons";

export type ReportListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  client: string | null;
  period: string | null;
  pendingComments: number;
  isMine: boolean;
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

export type HomeStats = { mine: number; pendingMine: number; noClient: number };

export function ReportsBrowser({
  reports,
  stats,
}: {
  reports: ReportListItem[];
  stats: HomeStats;
}) {
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [clientFilter, setClientFilter] = useState(ALL);
  const listRef = useRef<HTMLElement>(null);
  const [mineOnly, setMineOnly] = useState(false);

  // The three cards are presets over these filters. Tapping the one that is
  // already active clears them.
  const cardActive = {
    mine: mineOnly && !onlyPending && clientFilter === ALL,
    comments: mineOnly && onlyPending,
    noClient: clientFilter === NO_CLIENT && !mineOnly && !onlyPending,
  };
  function applyCard(card: keyof typeof cardActive) {
    if (cardActive[card]) {
      setMineOnly(false);
      setOnlyPending(false);
      setClientFilter(ALL);
      return;
    }
    setMineOnly(card !== "noClient");
    setOnlyPending(card === "comments");
    setClientFilter(card === "noClient" ? NO_CLIENT : ALL);
    // The filtered list sits below the cards; make the change visible.
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      if (mineOnly && !r.isMine) return false;
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
  }, [reports, query, onlyPending, clientFilter, mineOnly]);

  const cards = [
    { key: "mine" as const, value: stats.mine, label: "Mis reportes", hint: "publicados por vos" },
    {
      key: "comments" as const,
      value: stats.pendingMine,
      label: "Comentarios en mis reportes",
      hint: "sin resolver",
      attention: stats.pendingMine > 0,
    },
    {
      key: "noClient" as const,
      value: stats.noClient,
      label: "Sin cliente asignado",
      hint: "del equipo, para completar",
    },
  ];

  return (
    <>
    <div className="stat-cards">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => applyCard(c.key)}
          aria-pressed={cardActive[c.key]}
          className={`stat-card${cardActive[c.key] ? " on" : ""}`}
        >
          <span className={`stat-value${c.attention ? " attention" : ""}`}>
            {c.value.toLocaleString("es-AR")}
          </span>
          <span className="stat-label">{c.label}</span>
          <span className="stat-hint">{c.hint}</span>
        </button>
      ))}
    </div>

    <section className="list" ref={listRef} style={{ scrollMarginTop: 80 }}>
      <div className="list-head">
        <h2>Reportes publicados</h2>
        <span className="chip v">{reports.length}</span>
        <Link href="/reports/new" className="btn btn-primary btn-sm list-upload">
          <UploadIcon />
          Subir reporte
        </Link>
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
    </>
  );
}

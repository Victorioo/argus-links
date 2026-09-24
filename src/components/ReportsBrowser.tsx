"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export type ReportListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sizeBytes: number;
  views: number;
  updatedAt: string;
  createdByName: string;
  updatedByName: string | null;
  visibility: "PUBLIC" | "PASSWORD" | "RESTRICTED";
};

function visibilityLabel(v: ReportListItem["visibility"]) {
  if (v === "PASSWORD") return "🔒 Con contraseña";
  if (v === "RESTRICTED") return "👥 Restringido";
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReportsBrowser({ reports }: { reports: ReportListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.createdByName.toLowerCase().includes(q),
    );
  }, [reports, query]);

  return (
    <section className="list">
      <div className="list-head">
        <h2>Reportes publicados</h2>
        <span className="chip v">{reports.length}</span>
        <input
          type="search"
          placeholder="Buscar por título, descripción o autor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input search"
        />
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
                <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer" className="client">
                  {r.title}
                </a>
                {visibilityLabel(r.visibility) && (
                  <span className="chip" style={{ marginLeft: 8 }}>
                    {visibilityLabel(r.visibility)}
                  </span>
                )}
                {r.description && <div className="desc">{r.description}</div>}
                <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer" className="u">
                  /r/{r.slug}
                </a>
                <div className="meta">
                  <span>{r.createdByName}</span>
                  {r.updatedByName && r.updatedByName !== r.createdByName && (
                    <span>Actualizado por {r.updatedByName}</span>
                  )}
                  <span>{formatDate(r.updatedAt)}</span>
                  <span>{formatSize(r.sizeBytes)}</span>
                  <span>{r.views} vistas</span>
                </div>
              </div>
              <div className="btns">
                <CopyLinkButton path={`/r/${r.slug}`} />
                <Link href={`/reports/${r.id}`} className="btn btn-quiet btn-sm">
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

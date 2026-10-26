"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spotlight } from "@/components/Spotlight";
import { BELL_TOUR_KEY } from "@/components/tours";

type Item = {
  id: string;
  type: "COMMENT" | "REPLY";
  actorName: string;
  snippet: string;
  reportTitle: string;
  read: boolean;
  createdAt: string;
  href: string;
};

// The bell is a heads-up when you come in, not a live feed: it is loaded when the
// page opens and when the bell is opened. It is NOT polled in the background,
// because every query wakes the database and it is billed by the hours it is awake.
// Coming back to a tab that has been open for a while refreshes it once.
const STALE_MS = 2 * 60 * 60_000;

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [showTour, setShowTour] = useState(false);
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // red caída: se reintenta al abrir la campanita o al volver a la pestaña
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // Back on a tab that was left open for a while: refresh once. No timer.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoad.current > STALE_MS) load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // One-time "what is new" spotlight. If storage is unavailable we skip it
  // rather than risk showing it on every visit.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem(BELL_TOUR_KEY)) setShowTour(true);
      } catch {
        // sin localStorage no se muestra
      }
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  const endTour = useCallback(() => {
    setShowTour(false);
    try {
      localStorage.setItem(BELL_TOUR_KEY, "1");
    } catch {
      // ignorar
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(body: { id: string } | { all: true }) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function openItem(item: Item) {
    if (!item.read) await markRead({ id: item.id });
    window.location.assign(item.href);
  }

  async function markAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await markRead({ all: true });
  }

  return (
    <div className="bell" ref={wrapRef}>
      {showTour && (
        <Spotlight
          target={btnRef}
          title="Tus notificaciones"
          text="Ahora podés ver acá todas tus notificaciones: cuando alguien comenta en un reporte tuyo o responde uno de tus comentarios."
          onDone={endTour}
        />
      )}
      <button
        type="button"
        ref={btnRef}
        className="bell-btn"
        aria-label={unread ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-menu" role="menu">
          <div className="bell-head">
            <span>Notificaciones</span>
            {unread > 0 && (
              <button type="button" className="bell-link" onClick={markAll}>
                Marcar todo como leído
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="bell-empty">Todavía no tenés notificaciones.</div>
          ) : (
            <ul className="bell-list">
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" className={`bell-item${i.read ? "" : " unread"}`} onClick={() => openItem(i)}>
                    <span className="bell-text">
                      <b>{i.actorName}</b>{" "}
                      {i.type === "REPLY" ? "respondió tu comentario en" : "comentó en"} <b>{i.reportTitle}</b>
                    </span>
                    <span className="bell-snippet">{i.snippet}</span>
                    <span className="bell-time">{timeAgo(i.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

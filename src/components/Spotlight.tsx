"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Rect = { cx: number; cy: number; size: number };

const PAD = 10; // breathing room between the highlighted element and the ring
const TIP_W = 300;
const MARGIN = 12;

// "What's new" coach mark: dims the page, cuts a circular hole around `target`
// and shows a short message next to it. Rendered in a portal on <body>: the
// topbar uses backdrop-filter, which would otherwise trap position:fixed inside it. The parent decides when it is shown
// (and remembers that it was dismissed).
export function Spotlight({
  target,
  eyebrow = "Novedad",
  title,
  text,
  onDone,
}: {
  target: React.RefObject<HTMLElement | null>;
  eyebrow?: string;
  title: string;
  text: string;
  onDone: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    function measure() {
      const el = target.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        size: Math.max(r.width, r.height) + PAD * 2,
      });
    }
    function queue() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    frame = requestAnimationFrame(measure);
    window.addEventListener("resize", queue);
    window.addEventListener("scroll", queue, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue, true);
    };
  }, [target]);

  const ready = rect !== null;
  useEffect(() => {
    if (ready) buttonRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!rect) return null;

  const tipWidth = Math.min(TIP_W, window.innerWidth - MARGIN * 2);
  const tipLeft = Math.max(MARGIN, Math.min(rect.cx - tipWidth / 2, window.innerWidth - tipWidth - MARGIN));
  const tipTop = rect.cy + rect.size / 2 + 16;
  const arrowLeft = Math.max(18, Math.min(rect.cx - tipLeft, tipWidth - 18));

  return createPortal(
    <div className="spot" role="dialog" aria-modal="true" aria-label={title} onClick={onDone}>
      <div
        className="spot-hole"
        style={{ left: rect.cx - rect.size / 2, top: rect.cy - rect.size / 2, width: rect.size, height: rect.size }}
      />
      <div
        className="spot-tip"
        style={{ left: tipLeft, top: tipTop, width: tipWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="spot-arrow" style={{ left: arrowLeft }} />
        <span className="spot-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        <button ref={buttonRef} type="button" className="btn btn-primary btn-sm" onClick={onDone}>
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  );
}

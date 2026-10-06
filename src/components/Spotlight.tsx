"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Box = { left: number; top: number; width: number; height: number };

const PAD = 10; // breathing room between the highlighted element and the ring
const TIP_W = 300;
const TIP_H_ESTIMATE = 220; // used to decide whether the tip fits below the target
const MARGIN = 12;

// "What's new" coach mark: dims the page, cuts a hole around `target` (a circle
// for round buttons, a rounded rectangle for blocks) and shows a short message
// next to it. The parent decides when it is shown and remembers it was
// dismissed. Rendered in a portal on <body>: the topbar uses backdrop-filter,
// which would otherwise trap position:fixed inside it.
export function Spotlight({
  target,
  shape = "circle",
  eyebrow = "Novedad",
  title,
  text,
  onDone,
}: {
  target: React.RefObject<HTMLElement | null>;
  shape?: "circle" | "rect";
  eyebrow?: string;
  title: string;
  text: string;
  onDone: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    function measure() {
      const el = target.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (shape === "circle") {
        const size = Math.max(r.width, r.height) + PAD * 2;
        setBox({
          left: r.left + r.width / 2 - size / 2,
          top: r.top + r.height / 2 - size / 2,
          width: size,
          height: size,
        });
      } else {
        setBox({ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      }
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
  }, [target, shape]);

  const ready = box !== null;
  useEffect(() => {
    if (ready) buttonRef.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!box) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipWidth = Math.min(TIP_W, vw - MARGIN * 2);
  const centerX = box.left + box.width / 2;
  const tipLeft = Math.max(MARGIN, Math.min(centerX - tipWidth / 2, vw - tipWidth - MARGIN));
  const arrowLeft = Math.max(18, Math.min(centerX - tipLeft, tipWidth - 18));

  // Below the target when there is room, otherwise above it.
  const spaceBelow = vh - (box.top + box.height);
  const above = spaceBelow < TIP_H_ESTIMATE + 16 && box.top > spaceBelow;
  const tipStyle: React.CSSProperties = above
    ? { left: tipLeft, bottom: vh - box.top + 16, width: tipWidth }
    : { left: tipLeft, top: box.top + box.height + 16, width: tipWidth };

  return createPortal(
    <div className="spot" role="dialog" aria-modal="true" aria-label={title} onClick={onDone}>
      <div
        className="spot-hole"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          borderRadius: shape === "circle" ? "50%" : 22,
        }}
      />
      <div className="spot-tip" style={tipStyle} onClick={(e) => e.stopPropagation()}>
        <span className={`spot-arrow${above ? " down" : ""}`} style={{ left: arrowLeft }} />
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

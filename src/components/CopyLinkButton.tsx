"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/Icons";

export function CopyLinkButton({
  path,
  gold = false,
  iconOnly = false,
}: {
  path: string;
  gold?: boolean;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  const label = copied ? "¡Copiado!" : "Copiar link";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn btn-sm ${gold ? "btn-gold" : "btn-quiet"}${iconOnly ? " btn-icon" : ""}${copied ? " is-done" : ""}`}
      {...(iconOnly ? { title: label, "aria-label": label } : {})}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {!iconOnly && label}
    </button>
  );
}

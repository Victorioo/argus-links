"use client";

import { useState } from "react";

export function CopyLinkButton({ path, gold = false }: { path: string; gold?: boolean }) {
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn btn-sm ${gold ? "btn-gold" : "btn-quiet"}`}
    >
      {copied ? "¡Copiado!" : "Copiar link"}
    </button>
  );
}

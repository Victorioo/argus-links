"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, TrashIcon } from "@/components/Icons";

export function CopyTextButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copiá:", text);
    }
  }

  return (
    <button type="button" className="btn btn-quiet btn-sm" onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "¡Copiado!" : label}
    </button>
  );
}

export function DisconnectButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function disconnect() {
    if (!window.confirm(`¿Desconectar "${name}"? Va a dejar de poder leer tus reportes.`)) return;
    setPending(true);
    await fetch("/api/oauth/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    }).catch(() => {});
    setPending(false);
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-quiet btn-sm" disabled={pending} onClick={disconnect}>
      <TrashIcon size={14} />
      {pending ? "Desconectando…" : "Desconectar"}
    </button>
  );
}

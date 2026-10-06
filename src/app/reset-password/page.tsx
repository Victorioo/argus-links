"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setPending(true);
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error || "No se pudo cambiar la contraseña");
      return;
    }
    router.push("/login?reset=1");
  }

  if (!token) {
    return (
      <main className="wrap">
        <div className="login">
          <div className="panel">
            <span className="eyebrow">Equipo Argus</span>
            <h2>Link inválido</h2>
            <p>Este link no es válido. Pedí uno nuevo desde la pantalla de inicio de sesión.</p>
            <Link href="/forgot-password" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Pedir un link nuevo
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="login">
        <form onSubmit={handleSubmit} className="panel">
          <span className="eyebrow">Equipo Argus</span>
          <h2>Nueva contraseña</h2>
          <p>Elegí una contraseña nueva para tu cuenta.</p>

          <label className="mono-label" htmlFor="password">
            Nueva contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            style={{ marginTop: 8 }}
          />

          <label className="mono-label" htmlFor="confirm" style={{ marginTop: 14, display: "block" }}>
            Repetí la contraseña
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            style={{ marginTop: 8 }}
          />

          {error && (
            <div className="err">
              {error}{" "}
              {error.includes("venció") && (
                <Link href="/forgot-password" style={{ textDecoration: "underline" }}>
                  Pedir uno nuevo
                </Link>
              )}
            </div>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

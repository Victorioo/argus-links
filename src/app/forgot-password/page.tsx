"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error || "No se pudo procesar el pedido");
      return;
    }
    setSent(true);
  }

  return (
    <main className="wrap">
      <div className="login">
        <form onSubmit={handleSubmit} className="panel">
          <span className="eyebrow">Equipo Argus</span>
          <h2>Olvidé mi contraseña</h2>

          {sent ? (
            <>
              <p>
                Si existe una cuenta con <b>{email}</b>, te enviamos un link para elegir una nueva
                contraseña. Revisá tu bandeja de entrada (y el spam). El link vence en 1 hora.
              </p>
              <Link href="/login" className="btn btn-quiet" style={{ width: "100%", justifyContent: "center" }}>
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <p>Ingresá tu email y te mandamos un link para restablecerla.</p>

              <label className="mono-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                style={{ marginTop: 8 }}
              />

              {error && <div className="err">{error}</div>}

              <button type="submit" disabled={pending} className="btn btn-primary">
                {pending ? "Enviando..." : "Enviar link"}
              </button>

              <p style={{ marginTop: 18, marginBottom: 0, textAlign: "center" }}>
                <Link href="/login" style={{ color: "var(--violet-300)", fontWeight: 600 }}>
                  Volver a iniciar sesión
                </Link>
              </p>
            </>
          )}
        </form>
      </div>
    </main>
  );
}

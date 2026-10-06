"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "No se pudo crear la cuenta");
      setPending(false);
      return;
    }

    setPending(false);
    setSent(true);
  }

  async function resend() {
    setResent(false);
    await fetch("/api/verify/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResent(true);
  }

  if (sent) {
    return (
      <main className="wrap">
        <div className="login">
          <div className="panel">
            <span className="eyebrow">Equipo Argus</span>
            <h2>Revisá tu correo</h2>
            <p>
              Te enviamos un link de confirmación a <b>{email}</b>. Abrilo para activar tu cuenta y
              después iniciá sesión. Si no lo ves, mirá en spam.
            </p>
            {resent && <div className="hint ok">Listo, te enviamos otro email.</div>}
            <button type="button" className="btn btn-primary" onClick={resend}>
              Reenviar email
            </button>
            <p style={{ marginTop: 18, marginBottom: 0, textAlign: "center" }}>
              <Link href="/login" style={{ color: "var(--violet-300)", fontWeight: 600 }}>
                Ir a iniciar sesión
              </Link>
            </p>
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
          <h2>Crear cuenta</h2>
          <p>Report Hub del equipo &mdash; repositorio interno de reportes HTML.</p>

          <label className="mono-label" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            style={{ marginTop: 8 }}
          />

          <label className="mono-label" htmlFor="email" style={{ marginTop: 14, display: "block" }}>
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

          <label className="mono-label" htmlFor="password" style={{ marginTop: 14, display: "block" }}>
            Contraseña (mínimo 8 caracteres)
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

          {error && <div className="err">{error}</div>}

          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p style={{ marginTop: 18, marginBottom: 0, textAlign: "center" }}>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" style={{ color: "var(--violet-300)", fontWeight: 600 }}>
              Iniciá sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

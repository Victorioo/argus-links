"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
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

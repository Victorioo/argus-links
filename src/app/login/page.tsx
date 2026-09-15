"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }

    router.push(searchParams.get("from") || "/");
    router.refresh();
  }

  return (
    <main className="wrap">
      <div className="login">
        <form onSubmit={handleSubmit} className="panel">
          <span className="eyebrow">Equipo Argus</span>
          <h2>Iniciar sesión</h2>
          <p>Report Hub del equipo &mdash; repositorio interno de reportes HTML.</p>

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

          <label className="mono-label" htmlFor="password" style={{ marginTop: 14, display: "block" }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            style={{ marginTop: 8 }}
          />

          {error && <div className="err">{error}</div>}

          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Ingresando..." : "Ingresar"}
          </button>

          <p style={{ marginTop: 18, marginBottom: 0, textAlign: "center" }}>
            ¿No tenés cuenta?{" "}
            <Link href="/register" style={{ color: "var(--violet-300)", fontWeight: 600 }}>
              Registrate
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

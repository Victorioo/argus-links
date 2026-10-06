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
  const [unverified, setUnverified] = useState(false);
  const [resentNotice, setResentNotice] = useState(false);

  async function resendVerification() {
    await fetch("/api/verify/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setUnverified(false);
    setError(null);
    setResentNotice(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResentNotice(false);
    setPending(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (result?.error) {
      if (result.code === "email_not_verified") {
        setUnverified(true);
        setError("Todavía no confirmaste tu email. Abrí el link que te enviamos al registrarte.");
      } else {
        setUnverified(false);
        setError("Email o contraseña incorrectos");
      }
      return;
    }

    // Only same-site paths: "from" must not be able to send people elsewhere.
    const from = searchParams.get("from");
    router.push(from && from.startsWith("/") && !from.startsWith("//") ? from : "/");
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

          {searchParams.get("reset") === "1" && (
            <div className="hint ok" style={{ marginTop: 12 }}>
              Contraseña actualizada. Ya podés iniciar sesión.
            </div>
          )}

          {searchParams.get("verified") === "1" && (
            <div className="hint ok" style={{ marginTop: 12 }}>
              Email confirmado. Ya podés iniciar sesión.
            </div>
          )}

          {resentNotice && (
            <div className="hint ok" style={{ marginTop: 12 }}>
              Si la cuenta falta confirmarla, te enviamos un nuevo email.
            </div>
          )}

          {error && (
            <div className="err">
              {error}{" "}
              {unverified && (
                <button
                  type="button"
                  onClick={resendVerification}
                  style={{ background: "none", border: "none", padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
                >
                  Reenviar email
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Ingresando..." : "Ingresar"}
          </button>

          <p style={{ marginTop: 14, marginBottom: 0, textAlign: "center", fontSize: "0.85rem" }}>
            <Link href="/forgot-password" style={{ color: "var(--text-dim)", textDecoration: "underline" }}>
              Olvidé mi contraseña
            </Link>
          </p>

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

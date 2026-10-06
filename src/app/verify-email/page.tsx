"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "Este link no es válido.");
  // The token is single use: guard against React Strict Mode running the
  // effect twice in development, which would turn a success into an error.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    fetch("/api/verify/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setState("ok");
        } else {
          setMessage(data.error || "No se pudo confirmar el email.");
          setState("error");
        }
      })
      .catch(() => {
        setMessage("No se pudo confirmar el email.");
        setState("error");
      });
  }, [token]);

  return (
    <main className="wrap">
      <div className="login">
        <div className="panel">
          <span className="eyebrow">Equipo Argus</span>
          {state === "loading" && (
            <>
              <h2>Confirmando...</h2>
              <p>Un segundo, estamos activando tu cuenta.</p>
            </>
          )}
          {state === "ok" && (
            <>
              <h2>Email confirmado</h2>
              <p>Tu cuenta ya está activa. Ya podés iniciar sesión.</p>
              <Link href="/login?verified=1" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Iniciar sesión
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <h2>No pudimos confirmar</h2>
              <p>{message}</p>
              <Link href="/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                Ir a iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}

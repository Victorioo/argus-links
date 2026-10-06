import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { checkAuthorizeRequest } from "@/lib/oauth-authorize";

const KNOWN_HOSTS = ["claude.ai", "claude.com", "localhost", "127.0.0.1"];

// Consent screen. Only reachable signed in (the proxy sends everyone else to
// the login and brings them back here with the same query string).
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const query = await searchParams;
  const check = await checkAuthorizeRequest(query);

  if (!check.ok) {
    return (
      <main className="wrap">
        <div className="login">
          <div className="panel">
            <span className="eyebrow">Report Hub</span>
            <h2>No se puede conectar</h2>
            <p>{check.error}</p>
          </div>
        </div>
      </main>
    );
  }

  const { params, clientName, redirectHost } = check;
  const known = KNOWN_HOSTS.some((h) => redirectHost === h || redirectHost.endsWith(`.${h}`) || redirectHost.startsWith(`${h}:`));

  return (
    <main className="wrap">
      <div className="login">
        <form method="POST" action="/api/oauth/authorize" className="panel">
          <span className="eyebrow">Conectar con Report Hub</span>
          <h2>{clientName} quiere acceder a tus reportes</h2>
          <p>
            Vas a conectarte como <b>{session.user.name}</b> ({session.user.email}).
          </p>

          <div className="mono-label" style={{ marginBottom: 8 }}>Podrá</div>
          <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: "0.9rem", lineHeight: 1.6, listStyle: "disc" }}>
            <li>ver la lista de reportes a los que tenés acceso</li>
            <li>leer el contenido y los comentarios de esos reportes</li>
          </ul>
          <div className="mono-label" style={{ marginBottom: 8 }}>No podrá</div>
          <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: "0.9rem", lineHeight: 1.6, listStyle: "disc" }}>
            <li>crear, editar ni borrar nada</li>
          </ul>

          <p className={known ? "hint" : "hint warn"} style={{ marginBottom: 16 }}>
            {known ? (
              <>Después de aceptar volvés a <b>{redirectHost}</b>.</>
            ) : (
              <>
                Atención: después de aceptar se envía el acceso a <b>{redirectHost}</b>, que no es un sitio de Claude.
                Aceptá solo si lo reconocés.
              </>
            )}
          </p>

          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="client_id" value={params.clientId} />
          <input type="hidden" name="redirect_uri" value={params.redirectUri} />
          <input type="hidden" name="code_challenge" value={params.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value="S256" />
          <input type="hidden" name="state" value={params.state} />

          <div className="btn-row">
            <button type="submit" name="decision" value="allow" className="btn btn-primary">
              Permitir
            </button>
            <button type="submit" name="decision" value="deny" className="btn btn-quiet">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

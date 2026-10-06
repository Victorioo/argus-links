import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ClaudeLogo } from "@/components/ClaudeLogo";
import { CopyTextButton, DisconnectButton } from "@/components/ConnectClaude";
import { mcpUrl, parseRedirectUris } from "@/lib/oauth";

function formatDate(d: Date | null) {
  return d ? d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }) : "todavía sin usar";
}

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tokens = await prisma.oAuthToken.findMany({
    where: { userId: session.user.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  // One row per connected app, not per token.
  const byClient = new Map<
    string,
    { clientId: string; name: string; host: string; since: Date; lastUsed: Date | null }
  >();
  for (const t of tokens) {
    const existing = byClient.get(t.client.clientId);
    const host = (() => {
      try {
        return new URL(parseRedirectUris(t.client.redirectUris)[0]).host;
      } catch {
        return "";
      }
    })();
    if (!existing) {
      byClient.set(t.client.clientId, {
        clientId: t.client.clientId,
        name: t.client.clientName,
        host,
        since: t.createdAt,
        lastUsed: t.lastUsedAt,
      });
    } else {
      if (t.createdAt < existing.since) existing.since = t.createdAt;
      if (t.lastUsedAt && (!existing.lastUsed || t.lastUsedAt > existing.lastUsed)) existing.lastUsed = t.lastUsedAt;
    }
  }
  const connections = [...byClient.values()];
  const url = mcpUrl();

  return (
    <>
      <Navbar />
      <main className="wrap">
        <section className="claude-card" style={{ maxWidth: 720, margin: "40px auto 24px" }}>
          <div className="claude-brand">
            <ClaudeLogo height={26} />
          </div>
          <h2>Conectá tu Claude a Report Hub</h2>
          <p className="claude-lead">
            Conectando tu cuenta de Claude, vos podés pedirle que busque, lea y resuma los reportes del equipo y sus
            comentarios. Usa tu propio plan de Claude: no consume ninguna API ni crédito de la plataforma.
          </p>

          <div className="mono-label" style={{ marginBottom: 8 }}>Dirección del conector</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <code className="claude-url">{url}</code>
            <CopyTextButton text={url} label="Copiar dirección" />
          </div>

          <div className="mono-label" style={{ margin: "26px 0 8px" }}>En claude.ai y Claude Desktop</div>
          <ol className="claude-steps">
            <li>Abrí la configuración de conectores y elegí <b>Agregar conector personalizado</b>.</li>
            <li>Pegá la dirección de arriba y confirmá.</li>
            <li>Claude te manda acá para que inicies sesión y aceptes. Listo.</li>
          </ol>
          <p className="hint" style={{ marginTop: 8 }}>
            Si tu equipo usa un plan Team o Enterprise, un administrador (Owner) tiene que agregar primero el conector
            en la configuración de la organización.
          </p>

          <div className="mono-label" style={{ margin: "22px 0 8px" }}>En Claude Code</div>
          <code className="claude-url" style={{ display: "block", whiteSpace: "pre-wrap" }}>
            claude mcp add --transport http report-hub {url}
          </code>
          <p className="hint" style={{ marginTop: 8 }}>
            Después escribí <code>/mcp</code> dentro de Claude Code para iniciar sesión.
          </p>

          <div className="mono-label" style={{ margin: "26px 0 8px" }}>Qué puede hacer</div>
          <ul className="claude-steps" style={{ listStyle: "disc" }}>
            <li>Ver los reportes a los que tenés acceso, buscar en su contenido y leerlos.</li>
            <li>Ver los comentarios de cada reporte.</li>
            <li><b>Solo lectura:</b> no puede crear, editar ni borrar nada.</li>
          </ul>

          <div className="mono-label" style={{ margin: "26px 0 10px" }}>Tus conexiones</div>
          {connections.length === 0 ? (
            <p className="hint">Todavía no conectaste ninguna aplicación.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {connections.map((c) => (
                <div key={c.clientId} className="claude-conn">
                  <div>
                    <b>{c.name}</b>
                    {c.host && <span style={{ opacity: 0.7 }}> · {c.host}</span>}
                    <div className="hint" style={{ margin: "4px 0 0" }}>
                      Conectado el {formatDate(c.since)} · último uso: {formatDate(c.lastUsed)}
                    </div>
                  </div>
                  <DisconnectButton clientId={c.clientId} name={c.name} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { parseRedirectUris } from "@/lib/oauth";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
};

export type AuthorizeCheck =
  | { ok: true; params: AuthorizeParams; clientName: string; redirectHost: string }
  | { ok: false; error: string };

type Source = { get(name: string): unknown } | Record<string, string | string[] | undefined>;

function read(source: Source, key: string): string {
  if (typeof (source as { get?: unknown }).get === "function") {
    return String((source as { get(n: string): unknown }).get(key) ?? "");
  }
  const v = (source as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// Shared by the consent screen and the endpoint that issues the code. Anything
// wrong with client_id / redirect_uri is shown to the person, never redirected
// to (an unvalidated redirect would be an open redirect).
export async function checkAuthorizeRequest(source: Source): Promise<AuthorizeCheck> {
  const clientId = read(source, "client_id");
  const redirectUri = read(source, "redirect_uri");
  const codeChallenge = read(source, "code_challenge");
  const state = read(source, "state");

  if (read(source, "response_type") !== "code") {
    return { ok: false, error: "Solicitud inválida (response_type)." };
  }
  if (!clientId || !redirectUri) {
    return { ok: false, error: "Solicitud inválida: faltan datos de la aplicación." };
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) return { ok: false, error: "La aplicación no está registrada." };
  if (!parseRedirectUris(client.redirectUris).includes(redirectUri)) {
    return { ok: false, error: "La dirección de retorno no coincide con la registrada." };
  }

  // PKCE is mandatory, and only the S256 method.
  if (read(source, "code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return { ok: false, error: "Solicitud inválida: falta PKCE (S256)." };
  }

  return {
    ok: true,
    params: { clientId, redirectUri, codeChallenge, state: state.slice(0, 500) },
    clientName: client.clientName,
    redirectHost: new URL(redirectUri).host,
  };
}

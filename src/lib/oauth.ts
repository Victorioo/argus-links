import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/email";

// Minimal OAuth 2.1 authorization server for the read-only MCP endpoint:
// authorization code + PKCE (S256 only), public clients, dynamic registration,
// rotating refresh tokens. Only hashes of secrets are stored.

export const SCOPE = "reports:read";
export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

export function issuer(): string {
  return getAppUrl();
}

export function mcpUrl(): string {
  return `${issuer()}/api/mcp`;
}

export function resourceMetadataUrl(): string {
  return `${issuer()}/.well-known/oauth-protected-resource`;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

// PKCE: base64url(sha256(verifier)) must equal the stored challenge.
export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Exact-match redirect URIs, https only (plain http just for loopback, which
// is what desktop/CLI clients use).
export function isAllowedRedirectUri(uri: string): boolean {
  if (uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

export function parseRedirectUris(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- CORS
// Public-client endpoints are called by connector backends and, for tools like
// the MCP inspector, from browsers. They carry no cookies, so * is fine.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function oauthError(error: string, description: string, status = 400): Response {
  return withCors(
    NextResponse.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } }),
  );
}

// ---------------------------------------------------------------- bearer auth
export type McpUser = { id: string; name: string; email: string };

export async function authenticateBearer(req: Request): Promise<McpUser | null> {
  const header = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) return null;

  const token = await prisma.oAuthToken.findUnique({
    where: { accessHash: sha256Hex(m[1]) },
    include: { user: { select: { id: true, name: true, email: true, emailVerified: true } } },
  });
  if (!token || token.accessExpiresAt < new Date() || !token.user.emailVerified) return null;

  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    prisma.oAuthToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { id: token.user.id, name: token.user.name, email: token.user.email };
}

export function unauthorized(): Response {
  return withCors(
    NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}", scope="${SCOPE}"`,
          "Cache-Control": "no-store",
        },
      },
    ),
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  SCOPE,
  corsPreflight,
  oauthError,
  randomToken,
  sha256Hex,
  verifyPkce,
  withCors,
} from "@/lib/oauth";

async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return Object.fromEntries(
      Object.entries(body && typeof body === "object" ? body : {}).map(([k, v]) => [k, String(v ?? "")]),
    );
  }
  const text = await req.text().catch(() => "");
  return Object.fromEntries(new URLSearchParams(text));
}

function tokenResponse(access: string, refresh: string): Response {
  return withCors(
    NextResponse.json(
      {
        access_token: access,
        token_type: "Bearer",
        expires_in: Math.floor(ACCESS_TTL_MS / 1000),
        refresh_token: refresh,
        scope: SCOPE,
      },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    ),
  );
}

export async function POST(req: Request) {
  const p = await readParams(req);

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.client_id || !p.code_verifier) {
      return oauthError("invalid_request", "Faltan code, client_id o code_verifier");
    }

    const record = await prisma.oAuthCode.findUnique({
      where: { codeHash: sha256Hex(p.code) },
      include: { client: true, user: { select: { emailVerified: true } } },
    });
    if (
      !record ||
      record.expiresAt < new Date() ||
      record.client.clientId !== p.client_id ||
      (p.redirect_uri && p.redirect_uri !== record.redirectUri) ||
      !record.user.emailVerified ||
      !verifyPkce(p.code_verifier, record.codeChallenge)
    ) {
      return oauthError("invalid_grant", "El código es inválido, venció o ya fue usado");
    }

    // Single use: only the request that actually deletes the code may continue.
    const consumed = await prisma.oAuthCode.deleteMany({ where: { id: record.id } });
    if (consumed.count !== 1) {
      return oauthError("invalid_grant", "El código es inválido, venció o ya fue usado");
    }

    const access = randomToken("rhat");
    const refresh = randomToken("rhrt");
    await prisma.oAuthToken.create({
      data: {
        accessHash: sha256Hex(access),
        refreshHash: sha256Hex(refresh),
        accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        clientId: record.clientId,
        userId: record.userId,
      },
    });
    return tokenResponse(access, refresh);
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token || !p.client_id) {
      return oauthError("invalid_request", "Faltan refresh_token o client_id");
    }

    const oldHash = sha256Hex(p.refresh_token);
    const record = await prisma.oAuthToken.findUnique({
      where: { refreshHash: oldHash },
      include: { client: true, user: { select: { emailVerified: true } } },
    });
    if (
      !record ||
      record.refreshExpiresAt < new Date() ||
      record.client.clientId !== p.client_id ||
      !record.user.emailVerified
    ) {
      return oauthError("invalid_grant", "El refresh token es inválido o venció");
    }

    // Rotation: the old refresh token stops working as soon as it is used.
    const access = randomToken("rhat");
    const refresh = randomToken("rhrt");
    const rotated = await prisma.oAuthToken.updateMany({
      where: { id: record.id, refreshHash: oldHash },
      data: {
        accessHash: sha256Hex(access),
        refreshHash: sha256Hex(refresh),
        accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    if (rotated.count !== 1) {
      return oauthError("invalid_grant", "El refresh token es inválido o venció");
    }
    return tokenResponse(access, refresh);
  }

  return oauthError("unsupported_grant_type", "Solo authorization_code y refresh_token");
}

export function OPTIONS() {
  return corsPreflight();
}

import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corsPreflight, isAllowedRedirectUri, oauthError, withCors } from "@/lib/oauth";

const MAX_CLIENTS = 1000;

const schema = z.object({
  client_name: z.string().trim().max(100).optional(),
  redirect_uris: z.array(z.string()).min(1).max(10),
});

// RFC 7591 dynamic client registration. Clients are always public (PKCE, no
// secret). Registration alone grants nothing: a person still has to approve
// each client on the consent screen, which shows where it will send them.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return oauthError("invalid_client_metadata", "client_name y redirect_uris son requeridos");
  }
  const { client_name, redirect_uris } = parsed.data;

  if (!redirect_uris.every(isAllowedRedirectUri)) {
    return oauthError("invalid_redirect_uri", "Las redirect_uris deben ser https (o http en localhost)");
  }
  if ((await prisma.oAuthClient.count()) >= MAX_CLIENTS) {
    return oauthError("temporarily_unavailable", "Demasiados clientes registrados", 503);
  }

  const clientId = `rhc_${crypto.randomBytes(16).toString("base64url")}`;
  const name = client_name || "Aplicación sin nombre";
  await prisma.oAuthClient.create({
    data: { clientId, clientName: name, redirectUris: JSON.stringify(redirect_uris) },
  });

  return withCors(
    NextResponse.json(
      {
        client_id: clientId,
        client_name: name,
        redirect_uris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    ),
  );
}

export function OPTIONS() {
  return corsPreflight();
}

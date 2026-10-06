import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CODE_TTL_MS, issuer, randomToken, sha256Hex } from "@/lib/oauth";
import { checkAuthorizeRequest } from "@/lib/oauth-authorize";

function backTo(redirectUri: string, params: Record<string, string>): NextResponse {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

// The consent form posts here. Defenses against someone else triggering a grant
// on a signed-in person's behalf: the session cookie is SameSite=Lax (not sent
// on cross-site POSTs), the Origin must be ours, and consent is an explicit
// click on a page that cannot be framed.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    // Session ended (e.g. the account no longer exists): send them to sign in
    // again rather than showing raw JSON from a form submit.
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(issuer()).origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const check = await checkAuthorizeRequest(form);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const { params } = check;

  if (form.get("decision") !== "allow") {
    return backTo(params.redirectUri, {
      error: "access_denied",
      error_description: "El usuario canceló la conexión",
      state: params.state,
      iss: issuer(),
    });
  }

  const code = randomToken("rhcode");
  await prisma.oAuthCode.create({
    data: {
      codeHash: sha256Hex(code),
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      client: { connect: { clientId: params.clientId } },
      user: { connect: { id: session.user.id } },
    },
  });

  return backTo(params.redirectUri, { code, state: params.state, iss: issuer() });
}

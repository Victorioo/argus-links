import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listKnownClients } from "@/lib/clients";
import { AiError } from "@/lib/claude-edit";
import {
  AUTOFILL_DAILY_LIMIT,
  AUTOFILL_MODEL,
  aiEnabled,
  suggestReportData,
} from "@/lib/report-autofill";

export const maxDuration = 60;

const MAX_HTML_BYTES = 4 * 1024 * 1024; // same ceiling as an upload

const schema = z.object({
  html: z.string().min(1, "No hay contenido para analizar"),
});

// First slug that is not taken: base, base-2, base-3...
async function freeSlug(base: string): Promise<string> {
  for (let n = 1; n <= 30; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    const taken = await prisma.report.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return base;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Claude todavía no está configurado en esta plataforma." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { html } = parsed.data;
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json({ error: "El archivo es demasiado grande para analizarlo." }, { status: 413 });
  }

  const userId = session.user.id;
  const used = await prisma.aiRun.count({
    where: { userId, kind: "autofill", createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (used >= AUTOFILL_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Llegaste al límite de ${AUTOFILL_DAILY_LIMIT} autocompletados por día. Completá los datos a mano.` },
      { status: 429 },
    );
  }

  try {
    const suggestion = await suggestReportData({ html, knownClients: await listKnownClients() });

    // Claude already answered (and was charged): failing to log it must not
    // take the result away from the person.
    await prisma.aiRun
      .create({
        data: {
          userId,
          kind: "autofill",
          model: AUTOFILL_MODEL,
          inputTokens: suggestion.usage.inputTokens,
          outputTokens: suggestion.usage.outputTokens,
        },
      })
      .catch((err) => console.error("could not log autofill usage", err));

    return NextResponse.json({
      title: suggestion.title,
      description: suggestion.description,
      client: suggestion.client,
      period: suggestion.period,
      internal: suggestion.internal,
      slug: suggestion.slug ? await freeSlug(suggestion.slug) : null,
    });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("analyze failed", err);
    return NextResponse.json({ error: "No se pudo analizar el reporte. Probá de nuevo." }, { status: 500 });
  }
}

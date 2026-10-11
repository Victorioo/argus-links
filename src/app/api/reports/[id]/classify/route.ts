import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listKnownClients } from "@/lib/clients";
import { AiError } from "@/lib/claude-edit";
import {
  AUTOFILL_MODEL,
  CLASSIFY_DAILY_LIMIT,
  aiEnabled,
  suggestReportData,
} from "@/lib/report-autofill";

export const maxDuration = 60;

// Reads a report that is already published and proposes its client, period and
// whether it is internal. It only suggests: nothing is saved here, and the link
// is never touched (it may already be shared).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Claude todavía no está configurado en esta plataforma." }, { status: 503 });
  }

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, html: true, createdAt: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  const userId = session.user.id;
  const used = await prisma.aiRun.count({
    where: { userId, kind: "classify", createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (used >= CLASSIFY_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Llegaste al límite de ${CLASSIFY_DAILY_LIMIT} análisis por día. Seguí mañana.` },
      { status: 429 },
    );
  }

  try {
    // createdAt is the reference "today": a report with no date in it was most
    // likely about the month it was uploaded, not about this month.
    const suggestion = await suggestReportData({
      html: report.html,
      knownClients: await listKnownClients(),
      today: report.createdAt,
    });

    await prisma.aiRun
      .create({
        data: {
          userId,
          kind: "classify",
          reportId: report.id,
          model: AUTOFILL_MODEL,
          inputTokens: suggestion.usage.inputTokens,
          outputTokens: suggestion.usage.outputTokens,
        },
      })
      .catch((err) => console.error("could not log classify usage", err));

    return NextResponse.json({
      client: suggestion.client,
      period: suggestion.period,
      internal: suggestion.internal,
      description: suggestion.description,
    });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("classify failed", err);
    return NextResponse.json({ error: "No se pudo analizar el reporte. Probá de nuevo." }, { status: 500 });
  }
}

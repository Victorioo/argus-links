import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { EditReportForm } from "@/components/EditReportForm";
import { ClaudeApplyComments } from "@/components/ClaudeApplyComments";
import { aiEnabled } from "@/lib/claude-edit";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { allowedViewers: { select: { userId: true } } },
  });
  if (!report) {
    notFound();
  }

  const comments = report.allowComments
    ? await prisma.comment.findMany({
        where: { reportId: report.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Claude edits the stored HTML, so only top-level comments left on the main
  // page are candidates. Hidden entirely until an API key is configured.
  const aiComments = aiEnabled()
    ? await prisma.comment.findMany({
        where: { reportId: report.id, parentId: null, page: "" },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { replies: true } } },
      })
    : [];

  return (
    <>
      <Navbar />
      <main className="wrap">
        <section className="hero" style={{ padding: "48px 0 24px" }}>
          <span className="eyebrow">Editar reporte</span>
          <h2>{report.title}</h2>
        </section>
        {aiComments.length > 0 && (
          <ClaudeApplyComments
            reportId={report.id}
            slug={report.slug}
            comments={aiComments.map((c) => ({
              id: c.id,
              authorName: c.authorName,
              text: c.text,
              replyCount: c._count.replies,
            }))}
          />
        )}
        <EditReportForm
          id={report.id}
          initialTitle={report.title}
          initialDescription={report.description ?? ""}
          initialSlug={report.slug}
          initialAllowComments={report.allowComments}
          initialVisibility={report.visibility}
          initialHasPassword={!!report.passwordHash}
          initialViewerIds={report.allowedViewers.map((v) => v.userId)}
          initialComments={comments.map((c) => ({
            id: c.id,
            selector: c.selector,
            authorName: c.authorName,
            text: c.text,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}

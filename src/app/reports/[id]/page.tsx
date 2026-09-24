import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { EditReportForm } from "@/components/EditReportForm";

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

  return (
    <>
      <Navbar />
      <main className="wrap">
        <section className="hero" style={{ padding: "48px 0 24px" }}>
          <span className="eyebrow">Editar reporte</span>
          <h2>{report.title}</h2>
        </section>
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

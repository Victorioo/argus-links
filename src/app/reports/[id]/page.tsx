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
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    notFound();
  }

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
        />
      </main>
    </>
  );
}

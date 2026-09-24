import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ReportsBrowser, type ReportListItem } from "@/components/ReportsBrowser";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const reports = await prisma.report.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  const items: ReportListItem[] = reports.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    sizeBytes: r.sizeBytes,
    views: r.views,
    updatedAt: r.updatedAt.toISOString(),
    createdByName: r.createdBy.name,
    updatedByName: r.updatedBy?.name ?? null,
    visibility: r.visibility,
  }));

  return (
    <>
      <Navbar />
      <main className="wrap">
        <section className="hero">
          <span className="eyebrow">Herramienta interna · Equipo Argus</span>
          <h1>
            Subí el HTML. <em>Entregá el link.</em>
          </h1>
          <p className="lead">
            Reportes del equipo en un solo lugar, con dueño y versión. Si actualizás un
            reporte, el link que ya compartiste <b>no cambia</b>.
          </p>
        </section>
        <ReportsBrowser reports={items} />
      </main>
    </>
  );
}

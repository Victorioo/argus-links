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
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      // Top-level comments still waiting for someone to deal with them
      _count: { select: { comments: { where: { resolved: false, parentId: null } } } },
    },
  });

  const firstName = session.user.name?.trim().split(/\s+/)[0] || "equipo";

  const mine = reports.filter((r) => r.createdById === session.user.id);
  const stats = [
    { value: mine.length, label: "Mis reportes", hint: "publicados por vos" },
    {
      value: mine.reduce((n, r) => n + r._count.comments, 0),
      label: "Comentarios en mis reportes",
      hint: "sin resolver",
      attention: true,
    },
    {
      value: mine.reduce((n, r) => n + r.views, 0),
      label: "Vistas en mis reportes",
      hint: "en total",
    },
  ];

  const items: ReportListItem[] = reports.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    client: r.client,
    period: r.period,
    pendingComments: r._count.comments,
    sizeBytes: r.sizeBytes,
    views: r.views,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Cuenta eliminada",
    visibility: r.visibility,
  }));

  return (
    <>
      <Navbar />
      <main className="wrap">
        <section className="home-head">
          <h1 className="home-title">Hola, {firstName}</h1>
          <p className="lead">
            Los reportes del equipo, en un solo lugar. El link de cada reporte{" "}
            <b>no cambia</b> cuando lo actualizás.
          </p>
          <div className="stat-cards">
            {stats.map((s) => (
              <div key={s.label} className="stat-card">
                <div className={`stat-value${s.attention && s.value > 0 ? " attention" : ""}`}>
                  {s.value.toLocaleString("es-AR")}
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-hint">{s.hint}</div>
              </div>
            ))}
          </div>
        </section>
        <ReportsBrowser reports={items} />
      </main>
    </>
  );
}

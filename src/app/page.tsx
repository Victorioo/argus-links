import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiEnabled } from "@/lib/claude-edit";
import { Navbar } from "@/components/Navbar";
import { ReportsBrowser, type ReportListItem } from "@/components/ReportsBrowser";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Always `select` here: a plain findMany/include returns every column, and
  // `html` (the report itself, up to 4MB each) would be downloaded from the
  // database for all reports on every visit to the home page (~17MB vs ~15KB).
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      client: true,
      period: true,
      internal: true,
      views: true,
      createdAt: true,
      createdById: true,
      visibility: true,
      createdBy: { select: { name: true } },
      // Top-level comments still waiting for someone to deal with them
      _count: { select: { comments: { where: { resolved: false, parentId: null } } } },
    },
  });

  const firstName = session.user.name?.trim().split(/\s+/)[0] || "equipo";

  const mine = reports.filter((r) => r.createdById === session.user.id);
  const stats = {
    mine: mine.length,
    pendingMine: mine.reduce((n, r) => n + r._count.comments, 0),
    internal: reports.filter((r) => r.internal).length,
  };

  const unclassified = reports.filter((r) => !r.client?.trim() && !r.internal).length;

  const items: ReportListItem[] = reports.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    client: r.client,
    period: r.period,
    pendingComments: r._count.comments,
    isMine: r.createdById === session.user.id,
    internal: r.internal,
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
          <h1 className="home-title">
            Hola, <em>{firstName}</em>
          </h1>
          <p className="lead">
            Los reportes del equipo, en un solo lugar. El link de cada reporte{" "}
            <b>no cambia</b> cuando lo actualizás.
          </p>
          {unclassified > 0 && aiEnabled() && (
            <Link href="/reports/classify" className="classify-link">
              <span className="spark" aria-hidden="true">✦</span>
              {unclassified} {unclassified === 1 ? "reporte sin cliente" : "reportes sin cliente"} · Clasificar con Claude →
            </Link>
          )}
        </section>
        <ReportsBrowser reports={items} stats={stats} />
      </main>
    </>
  );
}

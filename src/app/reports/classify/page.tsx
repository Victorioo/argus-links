import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ClassifyReports } from "@/components/ClassifyReports";
import { ArrowLeftIcon } from "@/components/Icons";
import { listKnownClients } from "@/lib/clients";
import { aiEnabled } from "@/lib/claude-edit";

export default async function ClassifyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [reports, knownClients] = await Promise.all([
    prisma.report.findMany({
      where: { client: null, internal: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, createdAt: true },
    }),
    listKnownClients(),
  ]);

  return (
    <>
      <Navbar />
      <main className="wrap">
        <Link href="/" className="btn btn-quiet btn-sm" style={{ marginTop: 24 }}>
          <ArrowLeftIcon />
          Volver
        </Link>
        <section className="home-head">
          <h1 className="home-title">Clasificar reportes</h1>
          <p className="lead">
            Estos reportes todavía no tienen cliente. Claude lee cada uno y propone cliente, período
            y si es interno; vos revisás y guardás. <b>Los links no cambian.</b>
          </p>
        </section>
        <ClassifyReports
          reports={reports.map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            createdAt: r.createdAt.toISOString(),
          }))}
          knownClients={knownClients}
          aiEnabled={aiEnabled()}
        />
      </main>
    </>
  );
}

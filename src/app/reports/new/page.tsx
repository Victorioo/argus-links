import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/Navbar";
import { NewReportForm } from "@/components/NewReportForm";

export default async function NewReportPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <Navbar />
      <main className="wrap">
        <Link href="/" className="btn btn-quiet btn-sm" style={{ marginTop: 24 }}>
          ← Volver
        </Link>
        <section className="hero">
          <span className="eyebrow">Herramienta interna · Equipo Argus</span>
          <h1>
            Subí el HTML. <em>Entregá el link.</em>
          </h1>
          <p className="lead">
            Arrastrá un <b>.html</b>, ponele título y queda publicado en un link fijo. Si
            volvés a subir uno con el mismo link, el link no cambia.
          </p>
        </section>
        <NewReportForm />
      </main>
    </>
  );
}

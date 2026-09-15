import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="tb-word">
          ARGUS
        </Link>
        <span className="tb-label">
          <span className="pulse" />
          Report Hub
        </span>
        <div className="tb-right">
          <Link href="/reports/new" className="btn btn-primary btn-sm">
            Subir reporte
          </Link>
          <ThemeToggle />
          {session?.user && (
            <>
              <span className="mono-label" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.name}
              </span>
              <SignOutButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

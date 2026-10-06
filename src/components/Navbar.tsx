import Link from "next/link";
import { auth } from "@/auth";
import { ArgusLogo } from "@/components/ArgusLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { UploadIcon } from "@/components/Icons";
import { ClaudeFab } from "@/components/ClaudeFab";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export async function Navbar() {
  const session = await auth();

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" aria-label="Argus" style={{ display: "flex", alignItems: "center" }}>
            <ArgusLogo />
          </Link>
          <span className="tb-label">
            <span className="pulse" />
            Report Hub
          </span>
          <div className="tb-right">
            <Link href="/reports/new" className="btn btn-primary btn-sm">
              <UploadIcon />
              Subir reporte
            </Link>
            <ThemeToggle />
            {session?.user && <NotificationBell />}
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
      {/* Outside the header: its backdrop-filter would trap a position:fixed child. */}
      {session?.user && <ClaudeFab />}
    </>
  );
}

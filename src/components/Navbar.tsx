import Link from "next/link";
import { auth } from "@/auth";
import { ArgusLogo } from "@/components/ArgusLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { UploadIcon } from "@/components/Icons";
import { ClaudeMark } from "@/components/ClaudeLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export async function Navbar() {
  const session = await auth();

  return (
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
          <Link href="/connect" className="btn btn-quiet btn-sm" title="Conectar tu Claude a Report Hub">
            <span style={{ color: "#d97757", display: "inline-flex" }}>
              <ClaudeMark size={14} />
            </span>
            Claude
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClaudeMark } from "@/components/ClaudeLogo";

// Floating shortcut to "Conectar tu Claude". Hidden on that page itself.
export function ClaudeFab() {
  const pathname = usePathname();
  if (pathname === "/connect") return null;

  return (
    <Link href="/connect" className="claude-fab" aria-label="Conectar tu Claude a Report Hub" title="Conectar tu Claude">
      <ClaudeMark size={26} />
      <span className="claude-fab-label">Conectar Claude</span>
    </Link>
  );
}

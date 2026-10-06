"use client";

import { signOut } from "next-auth/react";
import { LogOutIcon } from "@/components/Icons";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="btn btn-quiet btn-sm"
    >
      <LogOutIcon />
      Salir
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  // The login page draws its own chrome-less screen.
  if (pathname === "/admin/login") return null;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const linkCls = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      pathname.startsWith(href)
        ? "bg-forest-700 text-white"
        : "text-stone-300 hover:bg-forest-800 hover:text-white"
    }`;

  return (
    <header className="bg-forest-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin/trips" className="font-bold text-white">
            ⛰️ TripApp Admin
          </Link>
          <nav className="flex gap-1">
            <Link href="/admin/trips" className={linkCls("/admin/trips")}>
              Trips
            </Link>
            <Link href="/admin/enquiries" className={linkCls("/admin/enquiries")}>
              Enquiries
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="text-sm text-stone-300 hover:text-white"
          >
            View site ↗
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-stone-500 px-3 py-1.5 text-sm text-stone-300 hover:bg-forest-800 hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1100] border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-forest-700">
            <span aria-hidden>⛰️</span> TripApp
          </Link>
          <nav className="text-sm font-medium text-stone-600">
            <Link href="/" className="hover:text-forest-700">
              All Treks
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-stone-500">
          © {new Date().getFullYear()} TripApp — trekking across India. Map data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline hover:text-forest-700"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{" "}
          contributors.
        </div>
      </footer>
    </div>
  );
}

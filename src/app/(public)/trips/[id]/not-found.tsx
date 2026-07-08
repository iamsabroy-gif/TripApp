import Link from "next/link";

export default function TripNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-6xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-bold text-stone-900">Trek not found</h1>
      <p className="mt-2 text-stone-600">
        This trek doesn&apos;t exist or is no longer published.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-forest-600 px-5 py-2.5 font-medium text-white hover:bg-forest-700"
      >
        Browse all treks
      </Link>
    </div>
  );
}

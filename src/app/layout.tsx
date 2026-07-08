import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TripApp — Treks Across India",
    template: "%s | TripApp",
  },
  description:
    "Curated trekking itineraries across India — explore day-by-day routes on the map and enquire in one click.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}

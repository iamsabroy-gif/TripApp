// JSON shapes produced by serializeFullTrip (src/lib/trips.ts), shared by the
// public detail page and the admin editor.

export interface TripImage {
  id: string;
  imageUrl: string;
  cloudPublicId: string | null;
}

export interface TripSite {
  id: string;
  siteName: string;
  siteDescription: string | null;
  images: TripImage[];
}

export interface TripDay {
  id: string;
  dayNumber: number;
  locationName: string;
  latitude: number;
  longitude: number;
  dayDescription: string | null;
  sortOrder: number;
  sites: TripSite[];
}

export interface FullTrip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  coverImageUrl: string | null;
  coverImagePublicId?: string | null;
  shortDescription: string | null;
  difficulty: "EASY" | "MODERATE" | "DIFFICULT" | null;
  basePrice: number | null;
  status: string;
  days: TripDay[];
}

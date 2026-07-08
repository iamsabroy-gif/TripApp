import { z } from "zod";

// ---------------------------------------------------------------------------
// Trip create/update payload (FSD §4.3) — a single nested payload:
// trip fields + days[] + sites[] + image URLs. Images are uploaded to
// Cloudinary separately; only URLs/public_ids arrive here.
// ---------------------------------------------------------------------------

export const DIFFICULTIES = ["EASY", "MODERATE", "DIFFICULT"] as const;
export const TRIP_STATUSES = ["DRAFT", "PUBLISHED"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const siteImageSchema = z.object({
  imageUrl: z.string().url("Image URL must be a valid URL"),
  cloudPublicId: z.string().max(255).optional().nullable(),
});

const siteSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required").max(150),
  siteDescription: z.string().max(10_000).optional().nullable(),
  images: z.array(siteImageSchema).default([]),
});

const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  locationName: z.string().trim().min(1, "Each day needs a location name").max(150),
  latitude: z
    .number()
    .min(-90, "Latitude out of range")
    .max(90, "Latitude out of range"),
  longitude: z
    .number()
    .min(-180, "Longitude out of range")
    .max(180, "Longitude out of range"),
  dayDescription: z.string().max(10_000).optional().nullable(),
  sortOrder: z.number().int().min(1),
  sites: z.array(siteSchema).default([]),
});

const tripBaseSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(150),
  startDate: isoDate,
  endDate: isoDate,
  coverImageUrl: z.string().url().optional().nullable(),
  coverImagePublicId: z.string().max(255).optional().nullable(),
  shortDescription: z.string().max(10_000).optional().nullable(),
  difficulty: z.enum(DIFFICULTIES).optional().nullable(),
  basePrice: z.number().min(0).max(99_999_999.99).optional().nullable(),
  status: z.enum(TRIP_STATUSES),
  days: z.array(itineraryDaySchema).default([]),
});

/**
 * Full trip payload validation (FSD §4.3 + §4.4).
 *
 * Draft saves may have an empty itinerary (admin saving early progress);
 * Publish enforces the full rule set: >= 1 day, each day location-tagged,
 * unique sort orders, end_date >= start_date.
 */
export const tripPayloadSchema = tripBaseSchema.superRefine((trip, ctx) => {
  if (Date.parse(trip.endDate) < Date.parse(trip.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after the start date",
    });
  }

  if (trip.status === "PUBLISHED" && trip.days.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["days"],
      message: "A published trip needs at least one itinerary day",
    });
  }

  const sortOrders = new Set<number>();
  for (const [i, day] of trip.days.entries()) {
    if (sortOrders.has(day.sortOrder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days", i, "sortOrder"],
        message: "Duplicate day order — each day must have a unique position",
      });
    }
    sortOrders.add(day.sortOrder);
  }
});

export type TripPayload = z.infer<typeof tripPayloadSchema>;

// ---------------------------------------------------------------------------
// Day reordering (FSD §4.3): bulk sort_order update
// ---------------------------------------------------------------------------

export const reorderDaysSchema = z
  .object({
    days: z
      .array(
        z.object({
          id: z.string().uuid(),
          sortOrder: z.number().int().min(1),
        })
      )
      .min(1),
  })
  .superRefine((payload, ctx) => {
    const orders = new Set(payload.days.map((d) => d.sortOrder));
    if (orders.size !== payload.days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days"],
        message: "Duplicate sort orders in reorder payload",
      });
    }
  });

export type ReorderDaysPayload = z.infer<typeof reorderDaysSchema>;

// ---------------------------------------------------------------------------
// Public enquiry (FSD §4.9)
// ---------------------------------------------------------------------------

/** Indian mobile: 10 digits starting 6–9 (FSD §4.9). */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Pragmatic RFC-5322-basic email check per FSD §4.9. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const enquirySchema = z.object({
  tripId: z.string().uuid("Invalid trip reference"),
  name: z.string().trim().min(2, "Please enter your name (min 2 characters)").max(100),
  phone: z
    .string()
    .trim()
    .regex(INDIAN_MOBILE_REGEX, "Enter a valid 10-digit Indian mobile number"),
  email: z
    .string()
    .trim()
    .max(150)
    .regex(EMAIL_REGEX, "Enter a valid email address"),
  // Honeypot anti-spam field (FSD §4.9) — must be empty; bots tend to fill it.
  website: z.string().max(0, "Invalid submission").optional().default(""),
});

export type EnquiryPayload = z.infer<typeof enquirySchema>;

// ---------------------------------------------------------------------------
// Public listing query params (FSD §4.7)
// ---------------------------------------------------------------------------

export const tripListQuerySchema = z.object({
  sort: z.enum(["date", "difficulty", "duration"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

/** Flattens a ZodError into { "path.to.field": "message" } for API responses. */
export function flattenZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

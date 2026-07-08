import { describe, expect, it } from "vitest";
import {
  enquirySchema,
  reorderDaysSchema,
  tripPayloadSchema,
  INDIAN_MOBILE_REGEX,
} from "../src/lib/validation";
import { checkRateLimit, resetRateLimiter } from "../src/lib/rate-limit";

// Unit tests for the validation rules called out in the FSD (§4.3, §4.4,
// §4.9, §8.10): date rules, publish vs draft, enquiry field validation.

const validDay = {
  dayNumber: 1,
  locationName: "Jobra",
  latitude: 32.2593,
  longitude: 77.2431,
  dayDescription: "Acclimatization walk",
  sortOrder: 1,
  sites: [],
};

const validTrip = {
  name: "Hampta Pass Trek",
  startDate: "2026-09-14",
  endDate: "2026-09-18",
  status: "PUBLISHED" as const,
  days: [validDay],
};

describe("trip payload validation (FSD §4.3/§4.4)", () => {
  it("accepts a valid published trip", () => {
    expect(tripPayloadSchema.safeParse(validTrip).success).toBe(true);
  });

  it("rejects end_date before start_date", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      startDate: "2026-09-18",
      endDate: "2026-09-14",
    });
    expect(result.success).toBe(false);
  });

  it("accepts end_date equal to start_date (single-day trek)", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      startDate: "2026-09-14",
      endDate: "2026-09-14",
    });
    expect(result.success).toBe(true);
  });

  it("rejects publishing with an empty itinerary", () => {
    const result = tripPayloadSchema.safeParse({ ...validTrip, days: [] });
    expect(result.success).toBe(false);
  });

  it("allows saving a draft with an empty itinerary (early progress)", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      status: "DRAFT",
      days: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a day without a location name", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      days: [{ ...validDay, locationName: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      tripPayloadSchema.safeParse({
        ...validTrip,
        days: [{ ...validDay, latitude: 91 }],
      }).success
    ).toBe(false);
    expect(
      tripPayloadSchema.safeParse({
        ...validTrip,
        days: [{ ...validDay, longitude: -181 }],
      }).success
    ).toBe(false);
  });

  it("rejects duplicate day sort orders", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      days: [validDay, { ...validDay, dayNumber: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid difficulty value", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      difficulty: "EXTREME",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = tripPayloadSchema.safeParse({
      ...validTrip,
      status: "ARCHIVED",
    });
    expect(result.success).toBe(false);
  });
});

describe("reorder-days payload (FSD §4.3)", () => {
  it("accepts unique sort orders", () => {
    const result = reorderDaysSchema.safeParse({
      days: [
        { id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff", sortOrder: 2 },
        { id: "7f9619ff-8b86-4d01-b42d-00cf4fc964ff", sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate sort orders", () => {
    const result = reorderDaysSchema.safeParse({
      days: [
        { id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff", sortOrder: 1 },
        { id: "7f9619ff-8b86-4d01-b42d-00cf4fc964ff", sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("enquiry validation (FSD §4.9)", () => {
  const validEnquiry = {
    tripId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    name: "Asha Verma",
    phone: "9876543210",
    email: "asha@example.com",
  };

  it("accepts a valid enquiry", () => {
    expect(enquirySchema.safeParse(validEnquiry).success).toBe(true);
  });

  it("rejects a single-character name", () => {
    expect(enquirySchema.safeParse({ ...validEnquiry, name: "A" }).success).toBe(false);
  });

  it.each([
    "12345",          // too short
    "1234567890",     // starts with 1
    "5876543210",     // starts with 5
    "98765432101",    // 11 digits
    "98765-43210",    // punctuation
    "+919876543210",  // country code not accepted
  ])("rejects invalid phone %s", (phone) => {
    expect(enquirySchema.safeParse({ ...validEnquiry, phone }).success).toBe(false);
  });

  it.each(["6000000000", "7123456789", "8123456789", "9999999999"])(
    "accepts valid Indian mobile %s",
    (phone) => {
      expect(INDIAN_MOBILE_REGEX.test(phone)).toBe(true);
      expect(enquirySchema.safeParse({ ...validEnquiry, phone }).success).toBe(true);
    }
  );

  it.each(["not-an-email", "a@b", "a b@c.com", "@example.com"])(
    "rejects invalid email %s",
    (email) => {
      expect(enquirySchema.safeParse({ ...validEnquiry, email }).success).toBe(false);
    }
  );

  it("rejects a filled honeypot field", () => {
    expect(
      enquirySchema.safeParse({ ...validEnquiry, website: "spam.example" }).success
    ).toBe(false);
  });

  it("rejects a non-UUID trip id", () => {
    expect(enquirySchema.safeParse({ ...validEnquiry, tripId: "42" }).success).toBe(false);
  });
});

describe("login rate limiter (FSD §4.1)", () => {
  it("allows 5 attempts then blocks the 6th within the window", () => {
    resetRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("login:1.2.3.4").allowed).toBe(true);
    }
    const sixth = checkRateLimit("login:1.2.3.4");
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks IPs independently", () => {
    resetRateLimiter();
    for (let i = 0; i < 6; i++) checkRateLimit("login:1.1.1.1");
    expect(checkRateLimit("login:2.2.2.2").allowed).toBe(true);
  });
});

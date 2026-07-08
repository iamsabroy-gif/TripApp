# TripApp — Trekking Web Application (Indian Locations)

Two-sided web application implementing the FSD v1.0 (July 2, 2026): a public
website for browsing published treks and sending enquiries, plus an auth-gated
admin console for managing trips, itineraries, and enquiries.

## Stack (FSD §3)

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js (App Router, single repo — public SSR/ISR pages, client-rendered `/admin/*`, API route handlers) |
| Styling | Tailwind CSS |
| Map / geolocation | Leaflet + OpenStreetMap tiles, Nominatim geocoding for the admin search box |
| Database | PostgreSQL via Prisma ORM |
| Images | Cloudinary signed direct-from-browser uploads; DB stores URLs + public_ids only |
| Auth | Single admin credential, bcrypt (cost 12), iron-session HTTP-only cookie, sliding 45-min expiry, login rate limiting (5/IP/15 min) |
| Tests | Vitest (validation + rate-limiter rules) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) — test + build on every push/PR |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start a local Postgres (or point DATABASE_URL at a managed instance)
docker compose up -d

# 3. Configure environment
cp .env.example .env    # then edit: SESSION_SECRET, ADMIN_PASSWORD, CLOUDINARY_*

# 4. Create the schema and seed the admin user
npm run db:push
npm run db:seed         # set SEED_SAMPLE_DATA=true for a demo trip

# 5. Run
npm run dev             # http://localhost:3000  (admin at /admin)
```

`npm test` runs the unit tests; `npm run build` produces the production build.

With the app running, `E2E_ADMIN_PASSWORD=<password> node scripts/e2e-admin-console.mjs`
drives the admin console in a real browser (login → create trip → add
itinerary day + site → publish → verify on the public API → draft save).

## Project layout

```
prisma/schema.prisma          Physical data model (FSD §5, snake_case tables)
prisma/seed.ts                Admin user (+ optional sample trip) seeding
src/middleware.ts             Session guard for /admin/* pages (FSD §4.1)
src/lib/
  session.ts, auth.ts         iron-session config, sliding expiry, requireAdmin
  rate-limit.ts               In-memory login/enquiry rate limiter
  validation.ts               Zod schemas: trip payload, reorder, enquiry (FSD §4.3/4.4/4.9)
  trips.ts                    Trip service: nested create/update, duplicate, reorder, serialization
  cloudinary.ts               Upload signing + asset cleanup (FSD §4.6)
  notifications.ts            Enquiry webhook stub (FSD §8.3)
src/app/api/                  REST endpoints (FSD §6)
src/app/(public)/             Trip listing (ISR, 5 min) + trip detail pages
src/app/admin/                Login, trip dashboard, trip editor, enquiries
src/components/public/        TripList, TripDetail, TripMap, ImageGallery, EnquiryForm
src/components/admin/         TripEditor (itinerary builder), MapPicker, ImageUploader
tests/validation.test.ts      Unit tests for the FSD validation rules
```

## API summary (FSD §6)

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/admin/login` · `/api/admin/logout` | Public / Admin |
| GET / POST | `/api/admin/trips` | Admin |
| GET / PUT / PATCH / DELETE | `/api/admin/trips/:id` | Admin |
| PATCH | `/api/admin/trips/:id/reorder-days` | Admin |
| POST | `/api/admin/trips/:id/duplicate` | Admin |
| GET | `/api/admin/enquiries?trip_id=&from=&to=&page=` | Admin |
| POST | `/api/uploads/sign` | Admin |
| GET | `/api/trips` · `/api/trips/:id` | Public (PUBLISHED only) |
| POST | `/api/enquiries` | Public |

## Operational notes

- **Draft exclusion** is enforced at the query level (`status = 'PUBLISHED'`),
  never just in the UI (FSD §8.5).
- **Password reset** is manual: re-run `npm run db:seed` with a new
  `ADMIN_PASSWORD` (FSD §8.6).
- **Enquiry notifications**: set `ENQUIRY_WEBHOOK_URL` to receive a JSON POST
  per enquiry; leave empty to rely on the admin dashboard (FSD §8.3).
- **Image uploads** require the `CLOUDINARY_*` env vars; without them the
  editor still works, minus uploads (`/api/uploads/sign` returns 503).
- The rate limiter is in-memory and assumes a single instance — swap in a
  Redis-backed limiter before scaling horizontally.
- **Deploy**: single web service on Render/Railway + managed Postgres; run
  `npx prisma migrate deploy` (or `db:push`) and the seed on first deploy.

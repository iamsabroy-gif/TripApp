// End-to-end smoke test of the admin console UI, driven with Playwright.
//
// Verifies the full entry flow: login redirect + login, creating a trip
// through the editor (fields, itinerary day with coordinates, site),
// publishing, dashboard listing, public API visibility, and draft saves.
//
// Usage:
//   1. Have the app running with a database, e.g.:
//        npm run db:push && npm run db:seed && npm run build && npm start
//   2. E2E_BASE_URL=http://localhost:3000 \
//      E2E_ADMIN_USERNAME=admin E2E_ADMIN_PASSWORD=... \
//      node scripts/e2e-admin-console.mjs
//
// Optional: PW_CHROMIUM=/path/to/chrome to pin a Chromium executable.

import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.E2E_ADMIN_USERNAME || "admin";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("Set E2E_ADMIN_PASSWORD to the seeded admin password.");
  process.exit(1);
}

const shots = new URL("../e2e-screenshots", import.meta.url).pathname;
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const runTag = `E2E ${Date.now()}`;

try {
  // 1. Login
  await page.goto(`${BASE}/admin/trips`);
  await page.waitForURL(/\/admin\/login/);
  console.log("✓ unauthenticated /admin/trips redirected to login");

  await page.fill("#username", USERNAME);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin\/trips/);
  console.log("✓ login succeeded, landed on dashboard");

  // 2. New trip
  await page.click("text=+ New trip");
  await page.waitForURL(/\/admin\/trips\/new/);
  await page.fill("#t-name", `Kedarkantha Winter Trek (${runTag})`);
  await page.fill("#t-start", "2026-12-20");
  await page.fill("#t-end", "2026-12-24");
  await page.selectOption("#t-diff", "MODERATE");
  await page.fill("#t-price", "11500");
  await page.fill("#t-desc", "Snow-laden summit climb in the Govind wildlife sanctuary.");
  console.log("✓ trip fields filled");

  // 3. Add an itinerary day (manual lat/lng entry instead of map click)
  await page.click("text=+ Add day");
  await page.fill('input[type="text"][maxlength="150"] >> nth=1', "Sankri");
  const numInputs = page.locator('input[type="number"][step="0.000001"]');
  await numInputs.nth(0).fill("31.0774");
  await numInputs.nth(1).fill("78.1885");
  await page.fill("textarea >> nth=1", "Drive from Dehradun to the roadhead village of Sankri.");
  console.log("✓ itinerary day added with coordinates");

  // 4. Add a site to the day
  await page.click("text=+ Add site");
  await page.fill('input[placeholder="Site name"]', "Sankri Village");
  await page.fill('textarea[placeholder="Site description"]', "Traditional Garhwali village at 6,400 ft.");
  console.log("✓ site added");

  await page.screenshot({ path: `${shots}/admin-editor-filled.png` });

  // 5. Publish
  await page.click("text=Publish");
  await page.waitForURL(/\/admin\/trips$/, { timeout: 15000 });
  console.log("✓ publish saved and returned to dashboard");

  // 6. Verify the row exists on the dashboard
  await page.waitForSelector(`text=Kedarkantha Winter Trek (${runTag})`);
  console.log("✓ dashboard shows the new trip");
  await page.screenshot({ path: `${shots}/admin-dashboard.png` });

  // 7. Verify it reached the DB via the public API
  const names = await page.evaluate(async () => {
    const res = await fetch("/api/trips");
    return (await res.json()).trips.map((t) => t.name);
  });
  if (!names.some((n) => n.includes(runTag))) {
    throw new Error("published trip missing from public /api/trips");
  }
  console.log("✓ published trip visible on public API");

  // 8. Draft save with empty itinerary also allowed
  await page.click("text=+ New trip");
  await page.waitForURL(/\/admin\/trips\/new/);
  await page.fill("#t-name", `Draft Only Trek (${runTag})`);
  await page.fill("#t-start", "2027-01-10");
  await page.fill("#t-end", "2027-01-12");
  await page.click("text=Save as draft");
  await page.waitForURL(/\/admin\/trips$/, { timeout: 15000 });
  await page.waitForSelector(`text=Draft Only Trek (${runTag})`);
  console.log("✓ draft with empty itinerary saved");

  console.log("\nALL ADMIN UI CHECKS PASSED");
} catch (err) {
  await page.screenshot({ path: `${shots}/admin-failure.png` });
  console.error("FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

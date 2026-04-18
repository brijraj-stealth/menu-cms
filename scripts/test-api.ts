#!/usr/bin/env tsx
/**
 * Automated API integration tests for restaurant CMS.
 * Requires the dev server running on localhost:3000.
 * Usage: npx tsx scripts/test-api.ts
 */

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "admin@menucms.com";
const ADMIN_PASSWORD = "Admin@123";

let sessionCookie = "";
let pass = 0;
let fail = 0;
const failures: string[] = [];

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: unknown,
  expectStatus = 200
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: sessionCookie,
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function check(label: string, status: number, expected: number, extraOk?: number) {
  const ok = status === expected || (extraOk !== undefined && status === extraOk);
  if (ok) {
    console.log(`  ✅ ${label} (${status})`);
    pass++;
  } else {
    console.log(`  ❌ ${label} — expected ${expected}, got ${status}`);
    fail++;
    failures.push(`${label}: expected ${expected}, got ${status}`);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function login() {
  console.log("\n── Auth ──────────────────────────────────────────────────────");

  // 1. Get CSRF token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { Cookie: sessionCookie } });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = csrfRes.headers.get("set-cookie") ?? "";
  sessionCookie = csrfCookies.split(";").find((c) => c.trim().startsWith("authjs.csrf-token"))?.split("=").slice(0, 2).join("=") ?? "";

  // 2. Sign in
  const params = new URLSearchParams({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    csrfToken,
    callbackUrl: `${BASE}/`,
    json: "true",
  });

  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
    },
    body: params.toString(),
    redirect: "manual",
  });

  const setCookie = signInRes.headers.get("set-cookie") ?? "";
  const sessionPart = setCookie.split(",").find((c) => c.trim().startsWith("authjs.session-token"));
  if (sessionPart) {
    const tokenValue = sessionPart.split(";")[0].trim();
    sessionCookie = `${sessionCookie}; ${tokenValue}`;
    console.log(`  ✅ Login successful`);
    pass++;
  } else {
    console.log(`  ❌ Login failed — no session cookie returned`);
    fail++;
    failures.push("Login: no session cookie returned");
  }
}

// ─── Main test runner ─────────────────────────────────────────────────────────

async function run() {
  console.log("🚀 Restaurant CMS — API Integration Tests");
  console.log(`   Target: ${BASE}`);

  // Auth
  await login();

  // ── /api/me ────────────────────────────────────────────────────────────────
  console.log("\n── /api/me ───────────────────────────────────────────────────");
  {
    const r = await req("GET", "/api/me");
    check("GET /api/me (authenticated)", r.status, 200);
  }

  // ── /api/allergens ────────────────────────────────────────────────────────
  console.log("\n── /api/allergens ────────────────────────────────────────────");
  let allergenId = "";
  {
    const r = await req("GET", "/api/allergens");
    check("GET /api/allergens", r.status, 200);

    const r2 = await req("POST", "/api/allergens", { name: `TestAllergen-${Date.now()}`, description: "test" });
    check("POST /api/allergens (create)", r2.status, 201);
    allergenId = ((r2.data as Record<string, { id: string }>).data?.id) ?? "";

    if (allergenId) {
      const r3 = await req("GET", `/api/allergens/${allergenId}`);
      check("GET /api/allergens/:id", r3.status, 200);

      const r4 = await req("PUT", `/api/allergens/${allergenId}`, { description: "updated" });
      check("PUT /api/allergens/:id", r4.status, 200);

      const r5 = await req("DELETE", `/api/allergens/${allergenId}`);
      check("DELETE /api/allergens/:id", r5.status, 200);
    }
  }

  // ── /api/properties ───────────────────────────────────────────────────────
  console.log("\n── /api/properties ───────────────────────────────────────────");
  let propertyId = "";
  {
    const r = await req("GET", "/api/properties");
    check("GET /api/properties", r.status, 200);

    const r2 = await req("POST", "/api/properties", { name: `TestProp-${Date.now()}`, description: "test" });
    check("POST /api/properties (create)", r2.status, 201);
    propertyId = ((r2.data as Record<string, { id: string }>).data?.id) ?? "";

    if (propertyId) {
      const r3 = await req("GET", `/api/properties/${propertyId}`);
      check("GET /api/properties/:id", r3.status, 200);

      const r4 = await req("PUT", `/api/properties/${propertyId}`, { name: "Updated Prop", location: "London" });
      check("PUT /api/properties/:id", r4.status, 200);
    }
  }

  // ── /api/venues ───────────────────────────────────────────────────────────
  console.log("\n── /api/venues ───────────────────────────────────────────────");
  let venueId = "";
  {
    if (propertyId) {
      const r = await req("GET", `/api/venues?propertyId=${propertyId}`);
      check("GET /api/venues?propertyId=...", r.status, 200);

      const r2 = await req("POST", "/api/venues", { name: `TestVenue-${Date.now()}`, propertyId });
      check("POST /api/venues (create)", r2.status, 201);
      venueId = ((r2.data as Record<string, { id: string }>).data?.id) ?? "";

      if (venueId) {
        const r3 = await req("GET", `/api/venues/${venueId}`);
        check("GET /api/venues/:id", r3.status, 200);

        const r4 = await req("PUT", `/api/venues/${venueId}`, { name: "Updated Venue", address: "123 Main St" });
        check("PUT /api/venues/:id", r4.status, 200);
      }
    } else {
      console.log("  ⚠️  Skipping venue tests (no propertyId)");
    }
  }

  // ── /api/menus ────────────────────────────────────────────────────────────
  console.log("\n── /api/menus ────────────────────────────────────────────────");
  let menuId = "";
  {
    const r = await req("GET", "/api/menus");
    check("GET /api/menus (all)", r.status, 200);

    if (venueId) {
      const r1 = await req("GET", `/api/menus?venueId=${venueId}`);
      check("GET /api/menus?venueId=...", r1.status, 200);

      const r2 = await req("POST", "/api/menus", { name: `TestMenu-${Date.now()}`, venueId });
      check("POST /api/menus (create)", r2.status, 201);
      menuId = ((r2.data as Record<string, { id: string }>).data?.id) ?? "";

      if (menuId) {
        const r3 = await req("GET", `/api/menus/${menuId}`);
        check("GET /api/menus/:id", r3.status, 200);

        const r4 = await req("PUT", `/api/menus/${menuId}`, {
          name: "Updated Menu",
          scheduleText: "Mon–Fri 12–22",
          phoneNumber: "+44 20 1234 5678",
        });
        check("PUT /api/menus/:id (incl. scheduleText)", r4.status, 200);

        // Validate scheduleText was saved
        const r4b = await req("GET", `/api/menus/${menuId}`);
        const saved = (r4b.data as Record<string, { scheduleText?: string }>).data?.scheduleText;
        if (saved === "Mon–Fri 12–22") {
          console.log(`  ✅ scheduleText persisted correctly`);
          pass++;
        } else {
          console.log(`  ❌ scheduleText not persisted — got: ${JSON.stringify(saved)}`);
          fail++;
          failures.push("scheduleText not persisted after PUT /api/menus/:id");
        }
      }
    } else {
      console.log("  ⚠️  Skipping menu create tests (no venueId)");
    }
  }

  // ── /api/menus/:id/videos ─────────────────────────────────────────────────
  console.log("\n── /api/menus/:id/videos ─────────────────────────────────────");
  let videoId = "";
  if (menuId) {
    const r = await req("POST", `/api/menus/${menuId}/videos`, { url: "https://youtube.com/watch?v=test", title: "Test Video" });
    check("POST /api/menus/:id/videos", r.status, 201);
    videoId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";

    if (videoId) {
      const r2 = await req("PUT", `/api/menus/${menuId}/videos/${videoId}`, { title: "Updated Video" });
      check("PUT /api/menus/:id/videos/:videoId", r2.status, 200);

      const r3 = await req("DELETE", `/api/menus/${menuId}/videos/${videoId}`);
      check("DELETE /api/menus/:id/videos/:videoId", r3.status, 200);
    }
  } else {
    console.log("  ⚠️  Skipping video tests (no menuId)");
  }

  // ── /api/menus/:id/featured-images ────────────────────────────────────────
  console.log("\n── /api/menus/:id/featured-images ────────────────────────────");
  let imageId = "";
  if (menuId) {
    const r = await req("POST", `/api/menus/${menuId}/featured-images`, { url: "https://example.com/img.jpg", title: "Test Image" });
    check("POST /api/menus/:id/featured-images", r.status, 201);
    imageId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";

    if (imageId) {
      const r2 = await req("PUT", `/api/menus/${menuId}/featured-images/${imageId}`, { title: "Updated Image" });
      check("PUT /api/menus/:id/featured-images/:imageId", r2.status, 200);

      const r3 = await req("DELETE", `/api/menus/${menuId}/featured-images/${imageId}`);
      check("DELETE /api/menus/:id/featured-images/:imageId", r3.status, 200);
    }
  } else {
    console.log("  ⚠️  Skipping featured image tests (no menuId)");
  }

  // ── /api/categories ───────────────────────────────────────────────────────
  console.log("\n── /api/categories ───────────────────────────────────────────");
  let categoryId = "";
  if (menuId) {
    const r = await req("POST", "/api/categories", { name: `TestCat-${Date.now()}`, menuId });
    check("POST /api/categories (create)", r.status, 201);
    categoryId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";

    if (categoryId) {
      const r2 = await req("PUT", `/api/categories/${categoryId}`, { name: "Updated Cat", isActive: false });
      check("PUT /api/categories/:id", r2.status, 200);
    }
  } else {
    console.log("  ⚠️  Skipping category tests (no menuId)");
  }

  // ── /api/subcategories ────────────────────────────────────────────────────
  console.log("\n── /api/subcategories ────────────────────────────────────────");
  let subCategoryId = "";
  if (categoryId) {
    const r = await req("POST", "/api/subcategories", { name: `TestSub-${Date.now()}`, categoryId });
    check("POST /api/subcategories (create)", r.status, 201);
    subCategoryId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";

    if (subCategoryId) {
      const r2 = await req("PUT", `/api/subcategories/${subCategoryId}`, { name: "Updated Sub", displayMode: "GRID" });
      check("PUT /api/subcategories/:id", r2.status, 200);
    }
  } else {
    console.log("  ⚠️  Skipping subcategory tests (no categoryId)");
  }

  // ── /api/items ────────────────────────────────────────────────────────────
  console.log("\n── /api/items ────────────────────────────────────────────────");
  let itemId = "";
  let itemId2 = "";
  if (subCategoryId) {
    const r = await req("POST", "/api/items", {
      name: `TestItem-${Date.now()}`,
      basePrice: 9.99,
      subCategoryId,
      variants: [{ name: "Small", price: 9.99 }, { name: "Large", price: 14.99 }],
    });
    check("POST /api/items (create with variants)", r.status, 201);
    itemId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";

    // Create second item for copy test
    const r1b = await req("POST", "/api/items", { name: `TestItem2-${Date.now()}`, basePrice: 5.50, subCategoryId });
    check("POST /api/items (create simple)", r1b.status, 201);
    itemId2 = ((r1b.data as Record<string, { id: string }>).data?.id) ?? "";

    if (itemId) {
      const r2 = await req("PUT", `/api/items/${itemId}`, { name: "Updated Item", basePrice: 12.50, allergenIds: [] });
      check("PUT /api/items/:id", r2.status, 200);
    }
  } else {
    console.log("  ⚠️  Skipping item tests (no subCategoryId)");
  }

  // ── /api/items/copy ───────────────────────────────────────────────────────
  console.log("\n── /api/items/copy ───────────────────────────────────────────");
  if (itemId && subCategoryId) {
    const r = await req("POST", "/api/items/copy", { itemIds: [itemId], targetSubCategoryId: subCategoryId });
    check("POST /api/items/copy", r.status, 201);
  } else {
    console.log("  ⚠️  Skipping copy test (no itemId)");
  }

  // ── /api/categories/reorder ───────────────────────────────────────────────
  console.log("\n── Reorder endpoints ─────────────────────────────────────────");
  if (categoryId) {
    const r = await req("PUT", "/api/categories/reorder", { orders: [{ id: categoryId, sortOrder: 5 }] });
    check("PUT /api/categories/reorder", r.status, 200);
  }
  if (subCategoryId) {
    const r = await req("PUT", "/api/subcategories/reorder", { orders: [{ id: subCategoryId, sortOrder: 3 }] });
    check("PUT /api/subcategories/reorder", r.status, 200);
  }
  if (itemId) {
    const r = await req("PUT", "/api/items/reorder", { orders: [{ id: itemId, sortOrder: 2 }] });
    check("PUT /api/items/reorder", r.status, 200);
  }

  // ── /api/menus/:id/duplicate ──────────────────────────────────────────────
  console.log("\n── /api/menus/:id/duplicate ──────────────────────────────────");
  let dupMenuId = "";
  if (menuId && venueId) {
    const r = await req("POST", `/api/menus/${menuId}/duplicate`, { venueId, name: `Dup-${Date.now()}` });
    check("POST /api/menus/:id/duplicate", r.status, 201);
    dupMenuId = ((r.data as Record<string, { id: string }>).data?.id) ?? "";
  } else {
    console.log("  ⚠️  Skipping duplicate test (no menuId/venueId)");
  }

  // ── /api/users ────────────────────────────────────────────────────────────
  console.log("\n── /api/users ────────────────────────────────────────────────");
  let testUserId = "";
  {
    const r = await req("GET", "/api/users");
    check("GET /api/users (admin)", r.status, 200);

    const r2 = await req("POST", "/api/users", {
      name: "Test Staff",
      email: `staff-${Date.now()}@test.com`,
      password: "Staff@1234",
      role: "STAFF",
    });
    check("POST /api/users (create staff)", r2.status, 201);
    testUserId = ((r2.data as Record<string, { id: string }>).data?.id) ?? "";

    if (testUserId) {
      const r3 = await req("GET", `/api/users/${testUserId}`);
      check("GET /api/users/:id (admin)", r3.status, 200);

      const r4 = await req("PUT", `/api/users/${testUserId}`, { name: "Updated Staff", isActive: false });
      check("PUT /api/users/:id (admin)", r4.status, 200);
    }
  }

  // ── /api/users/:id/access ─────────────────────────────────────────────────
  console.log("\n── /api/users/:id/access ─────────────────────────────────────");
  if (testUserId && propertyId) {
    const r = await req("GET", `/api/users/${testUserId}/access`);
    check("GET /api/users/:id/access (admin)", r.status, 200);

    const r2 = await req("POST", `/api/users/${testUserId}/access`, {
      type: "property",
      targetId: propertyId,
      permissions: ["VIEW", "ADD"],
    });
    check("POST /api/users/:id/access (grant property)", r2.status, 200);

    const r3 = await req("DELETE", `/api/users/${testUserId}/access`, {
      type: "property",
      targetId: propertyId,
    });
    check("DELETE /api/users/:id/access (revoke property)", r3.status, 200);
  } else {
    console.log("  ⚠️  Skipping access tests (no testUserId/propertyId)");
  }

  // ── /api/activity-log ─────────────────────────────────────────────────────
  console.log("\n── /api/activity-log ─────────────────────────────────────────");
  {
    const r = await req("GET", "/api/activity-log");
    check("GET /api/activity-log (all)", r.status, 200);

    const r2 = await req("GET", "/api/activity-log?type=menus");
    check("GET /api/activity-log?type=menus", r2.status, 200);

    const r3 = await req("GET", "/api/activity-log?type=items");
    check("GET /api/activity-log?type=items", r3.status, 200);
  }

  // ── Auth boundary checks (unauthenticated) ─────────────────────────────────
  console.log("\n── Auth boundary (no session) ────────────────────────────────");
  {
    const savedCookie = sessionCookie;
    sessionCookie = "";

    const r1 = await req("GET", "/api/properties");
    check("GET /api/properties without session → 401", r1.status, 401);

    const r2 = await req("GET", "/api/users");
    check("GET /api/users without session → 401", r2.status, 401);

    sessionCookie = savedCookie;
  }

  // ── Cleanup: delete test resources ────────────────────────────────────────
  console.log("\n── Cleanup ───────────────────────────────────────────────────");
  if (itemId2) { await req("DELETE", `/api/items/${itemId2}`); }
  if (itemId) { await req("DELETE", `/api/items/${itemId}`); }
  if (subCategoryId) { await req("DELETE", `/api/subcategories/${subCategoryId}`); }
  if (categoryId) { await req("DELETE", `/api/categories/${categoryId}`); }
  if (dupMenuId) { await req("DELETE", `/api/menus/${dupMenuId}`); }
  if (menuId) { await req("DELETE", `/api/menus/${menuId}`); }
  if (venueId) { await req("DELETE", `/api/venues/${venueId}`); }
  if (propertyId) { await req("DELETE", `/api/properties/${propertyId}`); }
  if (testUserId) { await req("DELETE", `/api/users/${testUserId}`); }
  console.log("  ✅ Cleanup done");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (failures.length > 0) {
    console.log("\nFailed checks:");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log("All tests passed! ✨");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});

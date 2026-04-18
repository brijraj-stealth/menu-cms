#!/usr/bin/env tsx
/**
 * Automated API integration tests — 80 test cases.
 * Requires dev server on localhost:3000.
 * Usage:  npx tsx scripts/test-api.ts
 */

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "admin@menucms.com";
const ADMIN_PASSWORD = "Admin@123";

let adminCookie = "";
let staffCookie = "";
let pass = 0;
let fail = 0;
const failures: string[] = [];

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: unknown,
  cookie = adminCookie
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Cookie: cookie };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function check(label: string, status: number, expected: number, extraOk?: number) {
  const ok = status === expected || (extraOk !== undefined && status === extraOk);
  if (ok) { console.log(`  ✅ ${label} (${status})`); pass++; }
  else    { console.log(`  ❌ ${label} — expected ${expected}, got ${status}`); fail++; failures.push(`${label}: expected ${expected}, got ${status}`); }
}

function checkVal(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else    { console.log(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); fail++; failures.push(`${label}`); }
}

function id(r: { data: unknown }): string {
  return ((r.data as Record<string, { id?: string }>).data?.id) ?? "";
}

// ─── Login helper ─────────────────────────────────────────────────────────────

async function login(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfRaw = csrfRes.headers.get("set-cookie") ?? "";
  let cookie = csrfRaw.split(";").find((c) => c.trim().startsWith("authjs.csrf-token"))?.split("=").slice(0, 2).join("=") ?? "";

  const params = new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/`, json: "true" });
  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: params.toString(),
    redirect: "manual",
  });
  const setCookie = signInRes.headers.get("set-cookie") ?? "";
  const sessionPart = setCookie.split(",").find((c) => c.trim().startsWith("authjs.session-token"));
  if (sessionPart) cookie = `${cookie}; ${sessionPart.split(";")[0].trim()}`;
  return cookie;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("🚀 Restaurant CMS — 80-case API Integration Tests\n");

  // ══════════════════════════════════════════════════════════════════════════
  // 1. AUTH
  // ══════════════════════════════════════════════════════════════════════════
  console.log("── 1. Auth ───────────────────────────────────────────────────");

  adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  checkVal("TC-01 Admin login succeeds (session cookie present)", adminCookie.includes("authjs.session-token"), true);

  // TC-02: Protected route without session → 401
  { const r = await req("GET", "/api/me", undefined, ""); check("TC-02 /api/me without session → 401", r.status, 401); }

  // TC-03: /api/me with valid session → 200
  { const r = await req("GET", "/api/me"); check("TC-03 /api/me authenticated → 200", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ALLERGENS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 2. Allergens ──────────────────────────────────────────────");
  let allergenId = "";

  { const r = await req("GET", "/api/allergens"); check("TC-04 List allergens", r.status, 200); }
  { const r = await req("POST", "/api/allergens", { name: `TestAllergen-${Date.now()}`, description: "auto-test", icon: "🧪" }); check("TC-05 Create allergen", r.status, 201); allergenId = id(r); }
  { const r = await req("GET",  `/api/allergens/${allergenId}`); check("TC-06 Get allergen by id", r.status, 200); }
  { const r = await req("PUT",  `/api/allergens/${allergenId}`, { description: "updated" }); check("TC-07 Update allergen", r.status, 200); }
  // Validation: empty name → 400
  { const r = await req("POST", "/api/allergens", { name: "" }); check("TC-08 Create allergen with empty name → 400", r.status, 400); }
  // Not found: get nonexistent allergen
  { const r = await req("GET",  "/api/allergens/nonexistent-id-xyz"); check("TC-09 Get nonexistent allergen → 404", r.status, 404); }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. PROPERTIES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 3. Properties ─────────────────────────────────────────────");
  let propertyId = "";

  { const r = await req("GET", "/api/properties"); check("TC-10 List properties (admin)", r.status, 200); }
  { const r = await req("POST", "/api/properties", { name: `TestProp-${Date.now()}`, description: "test", location: "London" }); check("TC-11 Create property", r.status, 201); propertyId = id(r); }
  { const r = await req("GET",  `/api/properties/${propertyId}`); check("TC-12 Get property by id", r.status, 200); }
  { const r = await req("PUT",  `/api/properties/${propertyId}`, { name: "Updated Prop", isActive: false }); check("TC-13 Update property (name + toggle active)", r.status, 200); }
  // Validation: missing name → 400
  { const r = await req("POST", "/api/properties", { description: "no name" }); check("TC-14 Create property without name → 400", r.status, 400); }
  // Not found
  { const r = await req("GET", "/api/properties/nonexistent-xyz"); check("TC-15 Get nonexistent property → 404", r.status, 404); }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. VENUES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 4. Venues ─────────────────────────────────────────────────");
  let venueId = "";

  { const r = await req("GET", `/api/venues?propertyId=${propertyId}`); check("TC-16 List venues for property", r.status, 200); }
  { const r = await req("POST", "/api/venues", { name: `TestVenue-${Date.now()}`, propertyId, address: "1 Test St" }); check("TC-17 Create venue", r.status, 201); venueId = id(r); }
  { const r = await req("GET",  `/api/venues/${venueId}`); check("TC-18 Get venue by id", r.status, 200); }
  { const r = await req("PUT",  `/api/venues/${venueId}`, { name: "Updated Venue", address: "99 New St" }); check("TC-19 Update venue", r.status, 200); }
  // Validation: missing propertyId
  { const r = await req("POST", "/api/venues", { name: "Bad Venue" }); check("TC-20 Create venue without propertyId → 400", r.status, 400); }
  // Not found
  { const r = await req("GET", "/api/venues/nonexistent-xyz"); check("TC-21 Get nonexistent venue → 404", r.status, 404); }
  // Missing queryParam
  { const r = await req("GET", "/api/venues"); check("TC-22 GET /api/venues without propertyId → 400", r.status, 400); }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. MENUS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 5. Menus ──────────────────────────────────────────────────");
  let menuId = "";

  { const r = await req("GET", "/api/menus"); check("TC-23 List all menus (admin)", r.status, 200); }
  { const r = await req("GET", `/api/menus?venueId=${venueId}`); check("TC-24 List menus by venue", r.status, 200); }
  { const r = await req("POST", "/api/menus", { name: `TestMenu-${Date.now()}`, venueId }); check("TC-25 Create menu", r.status, 201); menuId = id(r); }
  { const r = await req("GET",  `/api/menus/${menuId}`); check("TC-26 Get menu by id", r.status, 200); }

  // TC-27: Update menu with all text fields including scheduleText
  { const r = await req("PUT", `/api/menus/${menuId}`, { name: "Updated Menu", scheduleText: "Mon–Sun 12–22", phoneNumber: "+44 800 000", videoSectionHeader: "Watch Us", featuredSectionHeader: "Specials" }); check("TC-27 Update menu (scheduleText + fields)", r.status, 200); }

  // TC-28: Verify scheduleText persisted
  { const r = await req("GET", `/api/menus/${menuId}`); const saved = (r.data as Record<string, { scheduleText?: string }>).data?.scheduleText; checkVal("TC-28 scheduleText persisted after update", saved, "Mon–Sun 12–22"); }

  // TC-29: Duplicate slug conflict
  {
    await req("PUT", `/api/menus/${menuId}`, { slug: `test-slug-${Date.now()}` });
    const r2 = await req("POST", "/api/menus", { name: "Dup Slug Menu", venueId });
    const m2id = id(r2);
    const slugVal = ((await req("GET", `/api/menus/${menuId}`)).data as Record<string, { slug?: string }>).data?.slug ?? "";
    const r3 = await req("PUT", `/api/menus/${m2id}`, { slug: slugVal });
    check("TC-29 Duplicate menu slug → 409", r3.status, 409);
    await req("DELETE", `/api/menus/${m2id}`);
  }

  // TC-30: Validation — missing name
  { const r = await req("POST", "/api/menus", { venueId }); check("TC-30 Create menu without name → 400", r.status, 400); }

  // TC-31: Not found
  { const r = await req("GET", "/api/menus/nonexistent-xyz"); check("TC-31 Get nonexistent menu → 404", r.status, 404); }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. MENU VIDEOS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 6. Menu Videos ────────────────────────────────────────────");
  let videoId = "";

  { const r = await req("POST", `/api/menus/${menuId}/videos`, { url: "https://youtube.com/watch?v=abc123", title: "Intro" }); check("TC-32 Add video to menu", r.status, 201); videoId = id(r); }
  { const r = await req("PUT",  `/api/menus/${menuId}/videos/${videoId}`, { title: "Updated Intro", sortOrder: 1 }); check("TC-33 Update menu video", r.status, 200); }
  // Validation: missing url
  { const r = await req("POST", `/api/menus/${menuId}/videos`, { title: "No URL" }); check("TC-34 Add video without url → 400", r.status, 400); }
  { const r = await req("DELETE", `/api/menus/${menuId}/videos/${videoId}`); check("TC-35 Delete menu video", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. FEATURED IMAGES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 7. Featured Images ────────────────────────────────────────");
  let imageId = "";

  { const r = await req("POST", `/api/menus/${menuId}/featured-images`, { url: "https://example.com/hero.jpg", title: "Hero" }); check("TC-36 Add featured image", r.status, 201); imageId = id(r); }
  { const r = await req("PUT",  `/api/menus/${menuId}/featured-images/${imageId}`, { title: "Updated Hero", sortOrder: 0 }); check("TC-37 Update featured image", r.status, 200); }
  // Validation: missing url
  { const r = await req("POST", `/api/menus/${menuId}/featured-images`, { title: "No URL" }); check("TC-38 Add featured image without url → 400", r.status, 400); }
  { const r = await req("DELETE", `/api/menus/${menuId}/featured-images/${imageId}`); check("TC-39 Delete featured image", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. CATEGORIES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 8. Categories ─────────────────────────────────────────────");
  let categoryId = "";

  { const r = await req("POST", "/api/categories", { name: `TestCat-${Date.now()}`, menuId }); check("TC-40 Create category", r.status, 201); categoryId = id(r); }
  { const r = await req("PUT",  `/api/categories/${categoryId}`, { name: "Updated Cat", isActive: false }); check("TC-41 Update category (name + toggle active)", r.status, 200); }
  // Validation: missing menuId
  { const r = await req("POST", "/api/categories", { name: "BadCat" }); check("TC-42 Create category without menuId → 400", r.status, 400); }
  // Reorder
  { const r = await req("PUT", "/api/categories/reorder", { orders: [{ id: categoryId, sortOrder: 5 }] }); check("TC-43 Reorder categories", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. SUBCATEGORIES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 9. Subcategories ──────────────────────────────────────────");
  let subCategoryId = "";

  { const r = await req("POST", "/api/subcategories", { name: `TestSub-${Date.now()}`, categoryId }); check("TC-44 Create subcategory", r.status, 201); subCategoryId = id(r); }
  { const r = await req("PUT",  `/api/subcategories/${subCategoryId}`, { name: "Updated Sub", displayMode: "GRID" }); check("TC-45 Update subcategory (displayMode GRID)", r.status, 200); }
  { const r = await req("PUT",  `/api/subcategories/${subCategoryId}`, { displayMode: "LIST" }); check("TC-46 Update subcategory (displayMode LIST)", r.status, 200); }
  // Validation: missing categoryId
  { const r = await req("POST", "/api/subcategories", { name: "BadSub" }); check("TC-47 Create subcategory without categoryId → 400", r.status, 400); }
  // Reorder
  { const r = await req("PUT", "/api/subcategories/reorder", { orders: [{ id: subCategoryId, sortOrder: 2 }] }); check("TC-48 Reorder subcategories", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. ITEMS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 10. Items ─────────────────────────────────────────────────");
  let itemId = "";
  let itemId2 = "";

  // Get a real allergen id first
  const allergenListR = await req("GET", "/api/allergens");
  const allergenList = ((allergenListR.data as Record<string, Array<{ id: string }>>).data) ?? [];
  const firstAllergenId = allergenList[0]?.id ?? "";

  { const r = await req("POST", "/api/items", { name: `TestItem-${Date.now()}`, basePrice: 9.99, subCategoryId, variants: [{ name: "Small", price: 9.99 }, { name: "Large", price: 14.99 }], allergenIds: firstAllergenId ? [firstAllergenId] : [] }); check("TC-49 Create item with variants + allergens", r.status, 201); itemId = id(r); }
  { const r = await req("POST", "/api/items", { name: `TestItem2-${Date.now()}`, basePrice: 5.50, subCategoryId }); check("TC-50 Create item (simple)", r.status, 201); itemId2 = id(r); }
  { const r = await req("PUT",  `/api/items/${itemId}`, { name: "Updated Item", basePrice: 12.50, allergenIds: [] }); check("TC-51 Update item (clear allergens)", r.status, 200); }
  { const r = await req("PUT",  `/api/items/${itemId}`, { isActive: false }); check("TC-52 Archive item (isActive: false)", r.status, 200); }
  { const r = await req("PUT",  `/api/items/${itemId}`, { isActive: true }); check("TC-53 Restore item (isActive: true)", r.status, 200); }
  // Validation: missing subCategoryId
  { const r = await req("POST", "/api/items", { name: "BadItem", basePrice: 5 }); check("TC-54 Create item without subCategoryId → 400", r.status, 400); }
  // Validation: negative price
  { const r = await req("POST", "/api/items", { name: "BadPrice", basePrice: -1, subCategoryId }); check("TC-55 Create item with negative price → 400", r.status, 400); }
  // Reorder
  { const r = await req("PUT", "/api/items/reorder", { orders: [{ id: itemId, sortOrder: 3 }, { id: itemId2, sortOrder: 4 }] }); check("TC-56 Reorder items", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. ITEMS — COPY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 11. Items Copy ────────────────────────────────────────────");

  { const r = await req("POST", "/api/items/copy", { itemIds: [itemId, itemId2], targetSubCategoryId: subCategoryId }); check("TC-57 Copy items (multiple)", r.status, 201); const copied = ((r.data as Record<string, { copied?: number }>).data?.copied) ?? 0; checkVal("TC-58 Copy returns correct count (2)", copied, 2); }
  // Validation: empty itemIds
  { const r = await req("POST", "/api/items/copy", { itemIds: [], targetSubCategoryId: subCategoryId }); check("TC-59 Copy with empty itemIds → 400", r.status, 400); }

  // ══════════════════════════════════════════════════════════════════════════
  // 12. MENU DUPLICATE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 12. Menu Duplicate ────────────────────────────────────────");
  let dupMenuId = "";

  { const r = await req("POST", `/api/menus/${menuId}/duplicate`, { venueId, name: `Dup-${Date.now()}` }); check("TC-60 Duplicate menu", r.status, 201); dupMenuId = id(r); }
  // TC-61: Verify duplicate has same scheduleText
  {
    const [src, dup] = await Promise.all([req("GET", `/api/menus/${menuId}`), req("GET", `/api/menus/${dupMenuId}`)]);
    const srcText = (src.data as Record<string, { scheduleText?: string }>).data?.scheduleText;
    const dupText = (dup.data as Record<string, { scheduleText?: string }>).data?.scheduleText;
    checkVal("TC-61 Duplicated menu copies scheduleText", dupText, srcText);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. USERS — ADMIN OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 13. Users (admin) ─────────────────────────────────────────");
  let staffUserId = "";
  const staffEmail = `staff-${Date.now()}@test.com`;
  const staffPassword = "Staff@1234";

  { const r = await req("GET", "/api/users"); check("TC-62 List users (admin)", r.status, 200); }
  { const r = await req("POST", "/api/users", { name: "Test Staff", email: staffEmail, password: staffPassword, role: "STAFF" }); check("TC-63 Create staff user", r.status, 201); staffUserId = id(r); }
  { const r = await req("GET",  `/api/users/${staffUserId}`); check("TC-64 Get user by id (admin)", r.status, 200); }
  { const r = await req("PUT",  `/api/users/${staffUserId}`, { name: "Updated Staff", isActive: false }); check("TC-65 Update user name + deactivate (admin)", r.status, 200); }
  { const r = await req("PUT",  `/api/users/${staffUserId}`, { isActive: true }); check("TC-66 Reactivate user (admin)", r.status, 200); }
  // Duplicate email → 409
  { const r = await req("POST", "/api/users", { name: "Dup", email: staffEmail, password: staffPassword }); check("TC-67 Create user with duplicate email → 409", r.status, 409); }
  // Validation: short password
  { const r = await req("POST", "/api/users", { name: "ShortPwd", email: `short-${Date.now()}@test.com`, password: "123" }); check("TC-68 Create user with short password → 400", r.status, 400); }

  // ══════════════════════════════════════════════════════════════════════════
  // 14. USER ACCESS MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 14. User Access ───────────────────────────────────────────");

  { const r = await req("GET",  `/api/users/${staffUserId}/access`); check("TC-69 Get user access page (admin)", r.status, 200); }
  // Grant property access
  { const r = await req("POST", `/api/users/${staffUserId}/access`, { type: "property", targetId: propertyId, permissions: ["VIEW", "ADD", "EDIT"] }); check("TC-70 Grant property access (cascades to venue+menu)", r.status, 200); }
  // Grant venue access (override)
  { const r = await req("POST", `/api/users/${staffUserId}/access`, { type: "venue", targetId: venueId, permissions: ["VIEW"] }); check("TC-71 Grant venue access (override)", r.status, 200); }
  // Grant menu access
  { const r = await req("POST", `/api/users/${staffUserId}/access`, { type: "menu", targetId: menuId, permissions: ["VIEW", "EDIT"] }); check("TC-72 Grant menu access", r.status, 200); }
  // Revoke menu access
  { const r = await req("DELETE", `/api/users/${staffUserId}/access`, { type: "menu", targetId: menuId }); check("TC-73 Revoke menu access", r.status, 200); }
  // Revoke venue access (cascades)
  { const r = await req("DELETE", `/api/users/${staffUserId}/access`, { type: "venue", targetId: venueId }); check("TC-74 Revoke venue access (cascade)", r.status, 200); }
  // Revoke property access (cascade)
  { const r = await req("DELETE", `/api/users/${staffUserId}/access`, { type: "property", targetId: propertyId }); check("TC-75 Revoke property access (cascade)", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // 15. STAFF SECURITY BOUNDARIES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 15. Staff Security Boundaries ─────────────────────────────");

  staffCookie = await login(staffEmail, staffPassword);
  checkVal("TC-76 Staff login succeeds", staffCookie.includes("authjs.session-token"), true);

  // Staff cannot list users
  { const r = await req("GET", "/api/users", undefined, staffCookie); check("TC-77 Staff GET /api/users → 403", r.status, 403); }
  // Staff cannot create users
  { const r = await req("POST", "/api/users", { name: "Rogue", email: `rogue@test.com`, password: "Rogue@1234" }, staffCookie); check("TC-78 Staff POST /api/users → 403", r.status, 403); }
  // Staff cannot update another user
  { const r = await req("PUT", `/api/users/${staffUserId}`, { role: "SUPER_ADMIN" }, staffCookie); check("TC-79 Staff PUT /api/users/:id → 403", r.status, 403); }
  // Staff cannot grant permissions
  { const r = await req("POST", `/api/users/${staffUserId}/access`, { type: "property", targetId: propertyId, permissions: ["VIEW"] }, staffCookie); check("TC-80 Staff POST /api/users/:id/access → 403", r.status, 403); }

  // ══════════════════════════════════════════════════════════════════════════
  // 16. ACTIVITY LOG
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 16. Activity Log ──────────────────────────────────────────");

  for (const type of ["items", "menus", "categories", "subcategories", "venues", "properties", "users"]) {
    const r = await req("GET", `/api/activity-log?type=${type}`);
    check(`TC-XX Activity log filter: ${type}`, r.status, 200);
  }
  { const r = await req("GET", "/api/activity-log?type=all"); check("TC-XX Activity log: all", r.status, 200); }
  // Staff cannot access audit log
  { const r = await req("GET", "/api/activity-log", undefined, staffCookie); check("TC-XX Staff GET /api/activity-log → 403", r.status, 403); }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETES — verify all delete endpoints work
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── 17. Deletes ───────────────────────────────────────────────");

  // Get copied items to delete them
  const menuFull = await req("GET", `/api/menus/${menuId}`);
  const copiedItems: string[] = (menuFull.data as Record<string, { categories?: Array<{ subCategories?: Array<{ items?: Array<{ id: string }> }> }> }>).data?.categories
    ?.flatMap((c) => c.subCategories ?? [])
    ?.flatMap((s) => s.items ?? [])
    ?.map((i) => i.id)
    ?.filter((iid) => iid !== itemId && iid !== itemId2) ?? [];
  for (const cid of copiedItems) { await req("DELETE", `/api/items/${cid}`); }

  { const r = await req("DELETE", `/api/items/${itemId2}`); check("TC-XX DELETE /api/items/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/items/${itemId}`);  check("TC-XX DELETE /api/items/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/subcategories/${subCategoryId}`); check("TC-XX DELETE /api/subcategories/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/categories/${categoryId}`); check("TC-XX DELETE /api/categories/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/menus/${dupMenuId}`); check("TC-XX DELETE duplicated menu", r.status, 200); }
  { const r = await req("DELETE", `/api/menus/${menuId}`); check("TC-XX DELETE /api/menus/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/venues/${venueId}`); check("TC-XX DELETE /api/venues/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/properties/${propertyId}`); check("TC-XX DELETE /api/properties/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/allergens/${allergenId}`); check("TC-XX DELETE /api/allergens/:id", r.status, 200); }
  { const r = await req("DELETE", `/api/users/${staffUserId}`); check("TC-XX DELETE /api/users/:id", r.status, 200); }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(`Results: ${pass} passed, ${fail} failed  (total checked: ${pass + fail})`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log("All tests passed! ✨");
    process.exit(0);
  }
}

run().catch((err) => { console.error("Crash:", err); process.exit(1); });

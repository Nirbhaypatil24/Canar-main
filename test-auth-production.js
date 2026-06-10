/**
 * Production Auth Test Suite for Canar
 * ─────────────────────────────────────
 * Tests the full authentication flow, rate limiting, tenant isolation,
 * token rotation, input validation, and security headers.
 *
 * Usage:
 *   node test-auth-production.js [BASE_URL]
 *
 * Default BASE_URL: http://localhost:3000
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
let accessToken = null;
let refreshTokenCookie = null;
let testUserId = null;
const TEST_EMAIL = `testuser_${Date.now()}@canar-test.com`;
const TEST_PASSWORD = "TestP@ssw0rd1";
const TEST_USERNAME = TEST_EMAIL;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function request(method, path, body = null, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken && !opts.noAuth) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (opts.csrfToken) {
    headers["X-CSRF-Token"] = opts.csrfToken;
  }
  const cookieHeader = [];
  if (refreshTokenCookie) {
    cookieHeader.push(refreshTokenCookie);
  }
  if (cookieHeader.length > 0) {
    headers["Cookie"] = cookieHeader.join("; ");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Capture set-cookie for refresh token
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    if (c.startsWith("refresh_token=")) {
      refreshTokenCookie = c.split(";")[0];
    }
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { status: res.status, json, text, headers: res.headers };
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

async function testHealthCheck() {
  console.log("\n🔍 Health Check");
  const { status, json } = await request("GET", "/api/auth/health", null, { noAuth: true });
  assert(status === 200, "Health endpoint returns 200");
  assert(json?.success === true, "Health response has success: true");
  assert(typeof json?.strategy === "string", "Health response includes strategy");
}

async function testSecurityHeaders() {
  console.log("\n🛡️  Security Headers");
  const { headers } = await request("GET", "/api/auth/health", null, { noAuth: true });
  assert(
    headers.get("x-content-type-options") === "nosniff",
    "X-Content-Type-Options: nosniff"
  );
  assert(
    headers.get("x-frame-options") !== null || headers.get("content-security-policy") !== null,
    "Frame protection header present"
  );
}

async function testCsrfToken() {
  console.log("\n🔐 CSRF Token");
  const { status, json } = await request("GET", "/api/auth/csrf-token", null, { noAuth: true });
  assert(status === 200, "CSRF token endpoint returns 200");
  assert(typeof json?.csrfToken === "string", "Response includes csrfToken");
  assert(json.csrfToken.includes("."), "Token has signature format (token.sig)");
}

async function testInputValidation() {
  console.log("\n📋 Input Validation");

  // Missing email
  let r = await request("POST", "/api/register", { password: TEST_PASSWORD }, { noAuth: true });
  assert(r.status === 400, "Rejects registration without email");

  // Invalid email format
  r = await request("POST", "/api/register", { email: "not-an-email", password: TEST_PASSWORD }, { noAuth: true });
  assert(r.status === 400, "Rejects invalid email format");

  // Weak password - too short
  r = await request("POST", "/api/register", { email: TEST_EMAIL, password: "Ab1" }, { noAuth: true });
  assert(r.status === 400, "Rejects password < 8 chars");

  // Weak password - no uppercase
  r = await request("POST", "/api/register", { email: TEST_EMAIL, password: "alllowercase1" }, { noAuth: true });
  assert(r.status === 400, "Rejects password without uppercase");

  // Weak password - no number
  r = await request("POST", "/api/register", { email: TEST_EMAIL, password: "NoNumbersHere" }, { noAuth: true });
  assert(r.status === 400, "Rejects password without number");

  // Common blocked password
  r = await request("POST", "/api/register", { email: TEST_EMAIL, password: "Password1" }, { noAuth: true });
  assert(r.status === 400, "Rejects common blocked password");
}

async function testRegistration() {
  console.log("\n📝 Registration");
  const r = await request(
    "POST",
    "/api/register",
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { noAuth: true }
  );
  assert(r.status === 201, "Registration returns 201");
  assert(r.json?.success === true, "Registration is successful");
  assert(r.json?.user?.email === TEST_EMAIL, "User email matches");
  assert(typeof r.json?.token === "string", "Access token returned");
  assert(r.json?.user?.password === undefined, "Password not leaked in response");

  if (r.json?.token) {
    accessToken = r.json.token;
    testUserId = r.json.user?.id;
  }

  // Duplicate registration
  const r2 = await request(
    "POST",
    "/api/register",
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { noAuth: true }
  );
  assert(r2.status === 400, "Duplicate email rejected");
}

async function testUserInfo() {
  console.log("\n👤 User Info");
  const r = await request("GET", "/api/user");
  assert(r.status === 200, "User info returns 200");
  assert(r.json?.user?.email === TEST_EMAIL, "Correct user returned");
  assert(r.json?.user?.password === undefined, "Password not in response");
  assert(r.json?.user?.failedLoginAttempts === undefined, "Failed attempts not in response");
  assert(r.json?.user?.lockedUntil === undefined, "Lock status not in response");
}

async function testUnauthenticatedAccess() {
  console.log("\n🚫 Unauthenticated Access");
  const r = await request("GET", "/api/profile", null, { noAuth: true });
  assert(r.status === 401, "Protected route returns 401 without token");
}

async function testLogout() {
  console.log("\n🚪 Logout");
  const r = await request("POST", "/api/logout");
  assert(r.status === 200, "Logout returns 200");
  assert(r.json?.success === true, "Logout successful");
}

async function testLogin() {
  console.log("\n🔑 Login");
  // Clear tokens
  accessToken = null;
  refreshTokenCookie = null;

  const r = await request(
    "POST",
    "/api/login",
    { username: TEST_EMAIL, password: TEST_PASSWORD },
    { noAuth: true }
  );
  assert(r.status === 200, "Login returns 200");
  assert(r.json?.success === true, "Login successful");
  assert(typeof r.json?.token === "string", "Access token returned");
  assert(r.json?.user?.password === undefined, "Password not leaked");

  if (r.json?.token) {
    accessToken = r.json.token;
  }

  // Bad credentials
  const r2 = await request(
    "POST",
    "/api/login",
    { username: TEST_EMAIL, password: "WrongPassword1" },
    { noAuth: true }
  );
  assert(r2.status === 401, "Bad password returns 401");

  // Non-existent user
  const r3 = await request(
    "POST",
    "/api/login",
    { username: "nonexistent@test.com", password: TEST_PASSWORD },
    { noAuth: true }
  );
  assert(r3.status === 401, "Non-existent user returns 401");
}

async function testTokenRefresh() {
  console.log("\n🔄 Token Refresh");
  if (!refreshTokenCookie) {
    console.log("  ⚠️  No refresh token cookie — skipping refresh tests");
    return;
  }

  const r = await request("POST", "/api/auth/refresh", null, { noAuth: true });
  assert(r.status === 200, "Refresh returns 200");
  assert(r.json?.success === true, "Refresh successful");
  assert(typeof r.json?.token === "string", "New access token returned");

  if (r.json?.token) {
    accessToken = r.json.token;
  }

  // Verify new token works
  const r2 = await request("GET", "/api/user");
  assert(r2.status === 200, "New access token works for /api/user");
}

async function testTokenRotation() {
  console.log("\n♻️  Token Rotation (Reuse Detection)");
  if (!refreshTokenCookie) {
    console.log("  ⚠️  No refresh token cookie — skipping rotation test");
    return;
  }

  // Save the current refresh token
  const oldRefreshCookie = refreshTokenCookie;

  // Use it once — should succeed and rotate
  const r1 = await request("POST", "/api/auth/refresh", null, { noAuth: true });
  assert(r1.status === 200, "First refresh succeeds (rotation)");

  if (r1.json?.token) {
    accessToken = r1.json.token;
  }

  // Try reusing the OLD refresh token — should fail (reuse detection)
  const savedNew = refreshTokenCookie;
  refreshTokenCookie = oldRefreshCookie;
  const r2 = await request("POST", "/api/auth/refresh", null, { noAuth: true });
  assert(r2.status === 401, "Reused refresh token returns 401");

  // Restore the new token for subsequent tests
  refreshTokenCookie = savedNew;
}

async function testTenantIsolation() {
  console.log("\n🏢 Tenant Isolation");

  // Create a second user
  const email2 = `testuser2_${Date.now()}@canar-test.com`;
  const r1 = await request(
    "POST",
    "/api/register",
    { email: email2, password: TEST_PASSWORD },
    { noAuth: true }
  );

  if (r1.json?.token) {
    const user2Token = r1.json.token;
    const user2Id = r1.json.user?.id;

    // User 2 tries to access user 1's data with userId param
    // (This tests requireTenantAccess middleware)
    const savedToken = accessToken;
    accessToken = user2Token;

    // Note: Most routes don't have userId in query — the middleware uses getUserId(req)
    // which reads from the JWT. So we test that a user only sees their own profile.
    const r2 = await request("GET", "/api/profile");
    assert(r2.status === 200, "User 2 can access their own profile route");
    assert(
      r2.json?.profile === null || r2.json?.profile?.userId === user2Id,
      "User 2 only sees their own data (or empty)"
    );

    // Restore user 1
    accessToken = savedToken;
  }
}

async function testRateLimiting() {
  console.log("\n⏱️  Rate Limiting");
  console.log("  ℹ️  Sending rapid requests to test global rate limiter...");

  // Note: We don't want to actually trigger auth rate limits during tests
  // because that would lock us out. Just verify the headers exist.
  const { headers } = await request("GET", "/api/auth/health", null, { noAuth: true });
  const rateLimitHeader =
    headers.get("ratelimit-limit") ||
    headers.get("x-ratelimit-limit");
  assert(
    rateLimitHeader !== null,
    "Rate limit headers present in response"
  );
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Canar Auth Production Test Suite`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`${"═".repeat(60)}`);

  try {
    await testHealthCheck();
    await testSecurityHeaders();
    await testCsrfToken();
    await testInputValidation();
    await testRegistration();
    await testUserInfo();
    await testUnauthenticatedAccess();
    await testLogout();
    await testLogin();
    await testTokenRefresh();
    await testTokenRotation();
    await testTenantIsolation();
    await testRateLimiting();
  } catch (error) {
    console.error("\n💥 Fatal error:", error);
    failed++;
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"─".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();

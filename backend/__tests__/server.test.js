import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { createApp } from "../server.js";

function createPool(queryImpl = async () => ({ rows: [] })) {
  const client = {
    query: jest.fn(queryImpl),
    release: jest.fn(),
  };

  return {
    query: jest.fn(queryImpl),
    connect: jest.fn(async () => client),
  };
}

function createBcrypt({
                        hashResult = "hashed-password",
                        compareResult = true,
                      } = {}) {
  return {
    hash: jest.fn(async () => hashResult),
    compare: jest.fn(async () => compareResult),
  };
}

function createSessionMiddleware() {
  return (req, _res, next) => {
    const userId = req.headers["x-test-user-id"];
    const destroyFails = req.headers["x-test-destroy-error"] === "1";

    req.session = {
      userId: userId ? Number(userId) || userId : undefined,
      destroy(callback) {
        if (destroyFails) {
          callback(new Error("destroy failed"));
          return;
        }

        this.userId = undefined;
        callback();
      },
    };

    next();
  };
}

function createAuthLogger({
                            events = [],
                          } = {}) {
  return {
    logEvent: jest.fn(async (event) => {
      events.push(event);
    }),
    getRecentEventsForEmail: jest.fn(async () => events),
  };
}

async function startTestServer(overrides = {}) {
  const app = createApp({
    pool: overrides.pool ?? createPool(),
    bcryptLib: overrides.bcryptLib ?? createBcrypt(),
    sessionMiddleware: overrides.sessionMiddleware ?? createSessionMiddleware(),
    authLogger: overrides.authLogger ?? createAuthLogger(),
  });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1");
    instance.once("listening", () => resolve(instance));
    instance.once("error", reject);
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function request(baseUrl, path, { method = "GET", headers, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const parsedBody = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  return { response, body: parsedBody };
}

describe("server routes", () => {
  let activeServer;
  let consoleErrorSpy;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (activeServer) {
      await new Promise((resolve, reject) => {
        activeServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      activeServer = undefined;
    }

    jest.restoreAllMocks();
    consoleErrorSpy = undefined;
  });

  async function boot(overrides) {
    const started = await startTestServer(overrides);
    activeServer = started.server;
    return started.baseUrl;
  }

  test("GET / returns ok text", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/");

    expect(response.status).toBe(200);
    expect(body).toBe("ok");
  });

  test("GET /favicon.ico returns 204", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/favicon.ico");

    expect(response.status).toBe(204);
    expect(body).toBe("");
  });

  test("POST /api/compatibility returns compatible true when parts match", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/api/compatibility", {
      method: "POST",
      body: {
        cpu: { socket: "AM5", tdp: 105 },
        motherboard: { socket: "AM5", ramType: "DDR5", maxRam: 128 },
        ram: { type: "DDR5", capacity: 32 },
        gpu: { tdp: 200 },
        psu: { wattage: 700 },
      },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({ compatible: true, issues: [] });
  });

  test("POST /api/compatibility aggregates incompatibility issues", async () => {
    const baseUrl = await boot();

    const { body } = await request(baseUrl, "/api/compatibility", {
      method: "POST",
      body: {
        cpu: { socket: "AM5", tdp: 120 },
        motherboard: { socket: "LGA1700", ramType: "DDR5", maxRam: 64 },
        ram: { type: "DDR4", capacity: 128 },
        gpu: { tdp: 320 },
        psu: { wattage: 450 },
      },
    });

    expect(body.compatible).toBe(false);
    expect(body.issues.length).toBeGreaterThanOrEqual(3);
  });

  test("POST /auth/register rejects missing credentials", async () => {
    const bcryptLib = createBcrypt();
    const pool = createPool();
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, bcryptLib, authLogger });

    const { response, body } = await request(baseUrl, "/auth/register", {
      method: "POST",
      body: { email: "", password: "" },
    });

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "email/password required" });
    expect(bcryptLib.hash).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
    expect(authLogger.logEvent).not.toHaveBeenCalled();
  });

  test("POST /auth/register rejects short passwords", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/auth/register", {
      method: "POST",
      body: { email: "user@example.com", password: "short" },
    });

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "Password needs to be at least length of 10.",
    });
  });

  test("POST /auth/register creates a user and lowercases email", async () => {
    const bcryptLib = createBcrypt({ hashResult: "hashed-value" });
    const pool = createPool(
        jest
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              rows: [{ uid: 10, username: null, email: "user@example.com" }],
            }) // INSERT users
            .mockResolvedValueOnce({
              rows: [{ auth_id: 99 }],
            }) // INSERT auth
            .mockResolvedValueOnce({ rows: [] }) // COMMIT
    );
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, bcryptLib, authLogger });

    const { response, body } = await request(baseUrl, "/auth/register", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "jest-test-agent",
      },
      body: { email: "User@Example.com", password: "long-password" },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: { uid: 10, username: null, email: "user@example.com" },
    });
    expect(bcryptLib.hash).toHaveBeenCalledWith("long-password", 12);
    expect(pool.connect).toHaveBeenCalled();
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          authId: 99,
          attemptedEmail: "user@example.com",
          eventType: "register",
          success: true,
          ipAddress: "203.0.113.10",
          userAgent: "jest-test-agent",
        })
    );
  });

  test("POST /auth/register returns 409 on duplicate email", async () => {
    const pool = createPool(async () => {
      const error = new Error("duplicate");
      error.code = "23505";
      throw error;
    });
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, authLogger });

    const { response, body } = await request(baseUrl, "/auth/register", {
      method: "POST",
      body: { email: "user@example.com", password: "long-password" },
    });

    expect(response.status).toBe(409);
    expect(body).toEqual({ ok: false, error: "Email already exists" });
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedEmail: "user@example.com",
          eventType: "register",
          success: false,
          failureReason: "email_exists",
        })
    );
  });

  test("POST /auth/login rejects missing credentials", async () => {
    const pool = createPool();
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, authLogger });

    const { response, body } = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: {},
    });

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "email/password required" });
    expect(pool.query).not.toHaveBeenCalled();
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedEmail: null,
          eventType: "login",
          success: false,
          failureReason: "missing_credentials",
        })
    );
  });

  test("POST /auth/login rejects unknown users", async () => {
    const pool = createPool(async () => ({ rows: [] }));
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, authLogger });

    const { response, body } = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: "user@example.com", password: "long-password" },
    });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Invalid credentials" });
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedEmail: "user@example.com",
          eventType: "login",
          success: false,
          failureReason: "invalid_credentials",
        })
    );
  });

  test("POST /auth/login rejects incorrect password", async () => {
    const pool = createPool(async () => ({
      rows: [
        {
          uid: 7,
          username: null,
          email: "user@example.com",
          auth_id: 55,
          password_hash: "hash",
          account_lock: false,
          two_fa: false,
        },
      ],
    }));
    const bcryptLib = createBcrypt({ compareResult: false });
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, bcryptLib, authLogger });

    const { response, body } = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: "user@example.com", password: "wrong-password" },
    });

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Invalid credentials" });
    expect(bcryptLib.compare).toHaveBeenCalledWith("wrong-password", "hash");
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          authId: 55,
          attemptedEmail: "user@example.com",
          eventType: "login",
          success: false,
          failureReason: "invalid_credentials",
        })
    );
  });

  test("POST /auth/login returns user payload on success", async () => {
    const pool = createPool(async () => ({
      rows: [
        {
          uid: 7,
          username: null,
          email: "user@example.com",
          auth_id: 55,
          password_hash: "hash",
          account_lock: false,
          two_fa: false,
        },
      ],
    }));
    const bcryptLib = createBcrypt({ compareResult: true });
    const authLogger = createAuthLogger();
    const baseUrl = await boot({ pool, bcryptLib, authLogger });

    const { response, body } = await request(baseUrl, "/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-for": "198.51.100.20",
        "user-agent": "security-audit-test",
      },
      body: { email: "USER@EXAMPLE.COM", password: "long-password" },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: { uid: 7, username: null, email: "user@example.com" },
    });
    expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM users u"),
        ["user@example.com"]
    );
    expect(authLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          authId: 55,
          attemptedEmail: "user@example.com",
          eventType: "login",
          success: true,
          ipAddress: "198.51.100.20",
          userAgent: "security-audit-test",
        })
    );
  });

  test("GET /auth/me rejects unauthenticated requests", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/auth/me");

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Not Logged in" });
  });

  test("GET /auth/me returns the current user when authenticated", async () => {
    const pool = createPool(async () => ({
      rows: [{ uid: 42, email: "user@example.com" }],
    }));
    const baseUrl = await boot({ pool });

    const { response, body } = await request(baseUrl, "/auth/me", {
      headers: { "x-test-user-id": "42" },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: { uid: 42, email: "user@example.com" },
    });
    expect(pool.query).toHaveBeenCalledWith(
        "SELECT uid, email FROM users WHERE uid = $1",
        [42]
    );
  });

  test("POST /auth/logout clears the session", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/auth/logout", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  test("POST /auth/logout returns 500 when session destruction fails", async () => {
    const baseUrl = await boot();

    const { response, body } = await request(baseUrl, "/auth/logout", {
      method: "POST",
      headers: { "x-test-destroy-error": "1" },
    });

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Logout failed" });
  });

  test("GET /auth/logs returns current user's auth history", async () => {
    const pool = createPool(async (queryText) => {
      if (queryText.includes("SELECT uid, email FROM users")) {
        return { rows: [{ uid: 42, email: "user@example.com" }] };
      }

      return { rows: [] };
    });
    const authLogger = createAuthLogger({
      events: [
        {
          log_id: 1,
          event_type: "login",
          success: true,
          attempted_email: "user@example.com",
          created_at: "2026-03-13T12:00:00.000Z",
        },
        {
          log_id: 2,
          event_type: "login",
          success: false,
          attempted_email: "user@example.com",
          failure_reason: "invalid_credentials",
          created_at: "2026-03-13T11:00:00.000Z",
        },
      ],
    });
    const baseUrl = await boot({ pool, authLogger });

    const { response, body } = await request(baseUrl, "/auth/logs", {
      headers: { "x-test-user-id": "42" },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      logs: [
        {
          log_id: 1,
          event_type: "login",
          success: true,
          attempted_email: "user@example.com",
          created_at: "2026-03-13T12:00:00.000Z",
        },
        {
          log_id: 2,
          event_type: "login",
          success: false,
          attempted_email: "user@example.com",
          failure_reason: "invalid_credentials",
          created_at: "2026-03-13T11:00:00.000Z",
        },
      ],
    });
    expect(authLogger.getRecentEventsForEmail).toHaveBeenCalledWith({
      email: "user@example.com",
    });
  });

  test("GET /health reports database availability", async () => {
    const pool = createPool(async () => ({ rows: [{ ok: 1 }] }));
    const baseUrl = await boot({ pool });

    const { response, body } = await request(baseUrl, "/health");

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, db: 1 });
  });

  test("GET /health returns 500 when the database query fails", async () => {
    const pool = createPool(async () => {
      throw new Error("db unavailable");
    });
    const baseUrl = await boot({ pool });

    const { response, body } = await request(baseUrl, "/health");

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "db down" });
  });
});
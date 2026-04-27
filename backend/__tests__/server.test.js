import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import request from "supertest";
import session from "express-session";
import { createApp, createAuthLogger } from "../server.js";
import {
  applyIntegrationSchema,
  createIntegrationPool,
  seedPcParts,
  truncateIntegrationTables,
} from "./helpers/integrationTestDb.js";

function createTestApp(pool) {
  return createApp({
    pool,
    sessionSecret: "test-secret",
    sessionStore: new session.MemoryStore(),
    authLogger: createAuthLogger(pool),
  });
}

describe("server routes", () => {
  let pool;
  let app;
  let agent;
  let consoleErrorSpy;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-secret";
    pool = createIntegrationPool();
    await applyIntegrationSchema(pool);
  });

  beforeEach(async () => {
    await truncateIntegrationTables(pool);
    app = createTestApp(pool);
    agent = request.agent(app);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consoleErrorSpy = undefined;
  });

  afterAll(async () => {
    await pool.end();
  });

  test("GET / returns ok text", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("ok");
  });

  test("GET /favicon.ico returns 204", async () => {
    const response = await request(app).get("/favicon.ico");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  test("POST /api/compatibility returns compatible true when parts match", async () => {
    const response = await request(app)
      .post("/api/compatibility")
      .send({
        cpu: { socket: "AM5", tdp: 105 },
        motherboard: { socket: "AM5", ramType: "DDR5", maxRam: 128 },
        ram: { type: "DDR5", capacity: 32 },
        gpu: { tdp: 200 },
        psu: { wattage: 700 },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ compatible: true, issues: [] });
  });

  test("POST /auth/register creates users, auth, and auth_logs rows", async () => {
    const response = await agent
      .post("/auth/register")
      .set("x-forwarded-for", "203.0.113.10")
      .set("user-agent", "jest-test-agent")
      .send({
        email: "User@Example.com",
        password: "long-password",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      user: { id: 1, email: "user@example.com" },
    });

    const users = await pool.query("SELECT uid, email FROM users ORDER BY uid ASC");
    const auth = await pool.query("SELECT auth_id, uid FROM auth ORDER BY auth_id ASC");
    const logs = await pool.query(
      `SELECT auth_id, uid, attempted_email, event_type, success, ip_address, user_agent
         FROM auth_logs
        ORDER BY log_id ASC`
    );

    expect(users.rows).toEqual([{ uid: "1", email: "user@example.com" }]);
    expect(auth.rows).toHaveLength(1);
    expect(auth.rows[0].uid).toBe("1");
    expect(logs.rows).toEqual([
      {
        auth_id: auth.rows[0].auth_id,
        uid: "1",
        attempted_email: "user@example.com",
        event_type: "register",
        success: true,
        ip_address: "203.0.113.10",
        user_agent: "jest-test-agent",
      },
    ]);
  });

  test("POST /auth/register logs duplicate email failures against the existing auth row", async () => {
    await agent.post("/auth/register").send({
      email: "user@example.com",
      password: "long-password",
    });

    const duplicate = await request(app).post("/auth/register").send({
      email: "user@example.com",
      password: "long-password",
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ ok: false, error: "Email already exists" });

    const logs = await pool.query(
      `SELECT event_type, success, failure_reason, attempted_email
         FROM auth_logs
        ORDER BY log_id ASC`
    );

    expect(logs.rows).toEqual([
      {
        event_type: "register",
        success: true,
        failure_reason: null,
        attempted_email: "user@example.com",
      },
      {
        event_type: "register",
        success: false,
        failure_reason: "email_exists",
        attempted_email: "user@example.com",
      },
    ]);
  });

  test("POST /auth/login logs failed and successful attempts in the database", async () => {
    await agent.post("/auth/register").send({
      email: "user@example.com",
      password: "long-password",
    });

    await agent.post("/auth/logout");

    const badLogin = await agent.post("/auth/login").send({
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body).toEqual({ ok: false, error: "Invalid credentials" });

    const goodLogin = await agent.post("/auth/login").send({
      email: "user@example.com",
      password: "long-password",
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body).toEqual({
      ok: true,
      user: { id: 1, email: "user@example.com" },
    });

    const logs = await pool.query(
      `SELECT event_type, success, failure_reason, attempted_email
         FROM auth_logs
        ORDER BY log_id ASC`
    );

    expect(logs.rows).toEqual([
      {
        event_type: "register",
        success: true,
        failure_reason: null,
        attempted_email: "user@example.com",
      },
      {
        event_type: "login",
        success: false,
        failure_reason: "invalid_credentials",
        attempted_email: "user@example.com",
      },
      {
        event_type: "login",
        success: true,
        failure_reason: null,
        attempted_email: "user@example.com",
      },
    ]);
  });

  test("GET /auth/me returns the current user when authenticated", async () => {
    await agent.post("/auth/register").send({
      email: "me@example.com",
      password: "long-password",
    });

    const response = await agent.get("/auth/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      user: { id: 1, email: "me@example.com" },
    });
  });

  test("GET /auth/logs returns the current user's real auth history", async () => {
    await agent.post("/auth/register").send({
      email: "logs@example.com",
      password: "long-password",
    });

    await agent.post("/auth/logout");
    await agent.post("/auth/login").send({
      email: "logs@example.com",
      password: "wrong-password",
    });
    await agent.post("/auth/login").send({
      email: "logs@example.com",
      password: "long-password",
    });

    const response = await agent.get("/auth/logs");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.logs).toHaveLength(3);

    const summary = response.body.logs.map((log) => ({
      event_type: log.event_type,
      success: log.success,
      failure_reason: log.failure_reason ?? null,
    }));

    expect(summary).toEqual(
      expect.arrayContaining([
        { event_type: "register", success: true, failure_reason: null },
        { event_type: "login", success: false, failure_reason: "invalid_credentials" },
        { event_type: "login", success: true, failure_reason: null },
      ])
    );
  });

  test("POST /builds stores a build in builds and build_pc_parts", async () => {
    await seedPcParts(pool, [
      { type: "cpu", name: "Ryzen 5 5600X", price: 199, inventory: 5 },
      { type: "gpu", name: "RTX 3060", price: 329, inventory: 3 },
    ]);

    await agent.post("/auth/register").send({
      email: "builder@example.com",
      password: "long-password",
    });

    const response = await agent.post("/builds").send({
      title: "Balanced 1080p Starter",
      totalPrice: 528,
      compatible: true,
      parts: {
        cpu: { name: "Ryzen 5 5600X" },
        gpu: { name: "RTX 3060" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      build: {
        id: 1,
        title: "Ryzen 5 5600X + RTX 3060",
        totalPrice: 528,
        budget: null,
        compatible: true,
        performanceScore: null,
        parts: {
          cpu: {
            sku: 1,
            type: "cpu",
            name: "Ryzen 5 5600X",
            price: 199,
            inventory: 5,
          },
          gpu: {
            sku: 2,
            type: "gpu",
            name: "RTX 3060",
            price: 329,
            inventory: 3,
          },
        },
        createdAt: null,
      },
    });

    const builds = await pool.query("SELECT build_id, uid, price, validated FROM builds ORDER BY build_id ASC");
    const junctions = await pool.query(
      "SELECT build_id, sku FROM build_pc_parts ORDER BY junction_id ASC"
    );

    expect(builds.rows).toEqual([
      { build_id: "1", uid: "1", price: "528.00", validated: true },
    ]);
    expect(junctions.rows).toEqual([
      { build_id: "1", sku: "1" },
      { build_id: "1", sku: "2" },
    ]);
  });

  test("GET /builds/mine returns builds from the real joined schema", async () => {
    await seedPcParts(pool, [
      { type: "cpu", name: "Ryzen 7 7700X", price: 349, inventory: 4 },
      { type: "gpu", name: "RTX 4070", price: 599, inventory: 2 },
    ]);

    await agent.post("/auth/register").send({
      email: "saved@example.com",
      password: "long-password",
    });

    await agent.post("/builds").send({
      totalPrice: 948,
      compatible: true,
      parts: {
        cpu: { name: "Ryzen 7 7700X" },
        gpu: { name: "RTX 4070" },
      },
    });

    const response = await agent.get("/builds/mine");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      builds: [
        {
          id: 1,
          title: "Ryzen 7 7700X + RTX 4070",
          totalPrice: 948,
          budget: null,
          compatible: true,
          performanceScore: null,
          parts: {
            cpu: {
              sku: 1,
              type: "cpu",
              name: "Ryzen 7 7700X",
              price: 349,
              inventory: 4,
            },
            gpu: {
              sku: 2,
              type: "gpu",
              name: "RTX 4070",
              price: 599,
              inventory: 2,
            },
          },
          createdAt: null,
        },
      ],
    });
  });

  test("DELETE /builds/:buildId removes the build and junction rows", async () => {
    await seedPcParts(pool, [
      { type: "cpu", name: "Ryzen 5 7600X", price: 249, inventory: 7 },
    ]);

    await agent.post("/auth/register").send({
      email: "delete@example.com",
      password: "long-password",
    });

    await agent.post("/builds").send({
      totalPrice: 249,
      compatible: true,
      parts: {
        cpu: { name: "Ryzen 5 7600X" },
      },
    });

    const response = await agent.delete("/builds/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    const builds = await pool.query("SELECT COUNT(*)::int AS count FROM builds");
    const junctions = await pool.query("SELECT COUNT(*)::int AS count FROM build_pc_parts");

    expect(builds.rows[0].count).toBe(0);
    expect(junctions.rows[0].count).toBe(0);
  });

  test("GET /health reports database availability", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: 1 });
  });
});

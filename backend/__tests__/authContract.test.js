import request from "supertest";
import session from "express-session";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { createApp, createAuthLogger } from "../server.js";
import {
  applyIntegrationSchema,
  createIntegrationPool,
  truncateIntegrationTables,
} from "./helpers/integrationTestDb.js";

function createTestAgent(pool) {
  const app = createApp({
    pool,
    authLogger: createAuthLogger(pool),
    sessionSecret: "test-secret",
    sessionStore: new session.MemoryStore(),
  });

  return request.agent(app);
}

describe("Auth contract", () => {
  let pool;
  let agent;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    pool = createIntegrationPool();
    await applyIntegrationSchema(pool);
  });

  beforeEach(async () => {
    await truncateIntegrationTables(pool);
    agent = createTestAgent(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("POST /auth/register returns 400 and contract error for missing fields", async () => {
    const res = await agent.post("/auth/register").send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "email/password required" });
  });

  test("POST /auth/register returns 200 with { ok, user } and creates session", async () => {
    const register = await agent.post("/auth/register").send({
      email: "TeSt@Example.com",
      password: "1234567890",
    });

    expect(register.status).toBe(200);
    expect(register.body.ok).toBe(true);
    expect(register.body.user).toEqual({
      id: 1,
      email: "test@example.com",
    });

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      ok: true,
      user: { id: 1, email: "test@example.com" },
    });
  });

  test("POST /auth/login returns 401 with contract error on invalid credentials", async () => {
    await agent.post("/auth/register").send({
      email: "test@example.com",
      password: "1234567890",
    });

    await agent.post("/auth/logout");

    const res = await agent.post("/auth/login").send({
      email: "test@example.com",
      password: "wrong-password",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Invalid credentials" });
  });

  test("POST /auth/login returns 200 with { ok, user } for valid credentials", async () => {
    await agent.post("/auth/register").send({
      email: "user@example.com",
      password: "1234567890",
    });

    await agent.post("/auth/logout");

    const res = await agent.post("/auth/login").send({
      email: "user@example.com",
      password: "1234567890",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      user: { id: 1, email: "user@example.com" },
    });
  });

  test("GET /auth/me returns 401 and contract error when not logged in", async () => {
    const res = await agent.get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Not Logged in" });
  });

  test("POST /auth/logout returns 200 with { ok: true }", async () => {
    await agent.post("/auth/register").send({
      email: "logout@example.com",
      password: "1234567890",
    });

    const res = await agent.post("/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

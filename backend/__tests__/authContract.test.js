import request from "supertest";
import session from "express-session";
import { createApp } from "../server.js";

function createInMemoryUserPool() {
  const usersByEmail = new Map();
  let nextId = 1;
  let nextAuthId = 1;

  async function query(text, params = []) {
    const normalizedText = text.trim();

    if (normalizedText === "BEGIN" || normalizedText === "COMMIT" || normalizedText === "ROLLBACK") {
      return { rows: [] };
    }

    if (normalizedText.startsWith("INSERT INTO users(username, email)")) {
      const [, email] = params;
      if (usersByEmail.has(email)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }

      const user = { id: nextId++, email };
      usersByEmail.set(email, { ...user, password_hash: null, auth_id: null });
      return { rows: [{ id: user.id, email: user.email }] };
    }

    if (normalizedText.startsWith("INSERT INTO auth(uid, password_hash)")) {
      const [userId, passwordHash] = params;
      const user = Array.from(usersByEmail.values()).find((candidate) => candidate.id === userId);
      if (!user) {
        throw new Error("user missing for auth insert");
      }

      user.password_hash = passwordHash;
      user.auth_id = nextAuthId++;
      return { rows: [{ auth_id: user.auth_id }] };
    }

    if (normalizedText.includes("FROM users u") && normalizedText.includes("JOIN auth a")) {
      const [email] = params;
      const user = usersByEmail.get(email);
      if (!user) return { rows: [] };
      return {
        rows: [
          {
            id: user.id,
            email: user.email,
            auth_id: user.auth_id,
            password_hash: user.password_hash,
            account_lock: false,
            two_fa: false,
          },
        ],
      };
    }

    if (normalizedText === "SELECT uid AS id, email FROM users WHERE uid = $1") {
      const [id] = params;
      const user = Array.from(usersByEmail.values()).find((u) => u.id === id);
      if (!user) return { rows: [] };
      return { rows: [{ id: user.id, email: user.email }] };
    }

    if (normalizedText === "SELECT 1 as ok") {
      return { rows: [{ ok: 1 }] };
    }

    throw new Error(`Unexpected query in test pool: ${text}`);
  }

  return {
    async query(text, params = []) {
      return query(text, params);
    },
    async connect() {
      return {
        query,
        release() {},
      };
    },
  };
}

const fakeBcrypt = {
  async hash(password) {
    return `hash:${password}`;
  },
  async compare(password, hash) {
    return hash === `hash:${password}`;
  },
};

function createTestAgent() {
  const app = createApp({
    pool: createInMemoryUserPool(),
    sessionSecret: "test-secret",
    sessionStore: new session.MemoryStore(),
    bcryptImpl: fakeBcrypt,
  });

  return request.agent(app);
}

describe("Auth contract", () => {
  test("POST /auth/register returns 400 and contract error for missing fields", async () => {
    const agent = createTestAgent();

    const res = await agent.post("/auth/register").send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "email/password required" });
  });

  test("POST /auth/register returns 200 with { ok, user } and creates session", async () => {
    const agent = createTestAgent();

    const register = await agent.post("/auth/register").send({
      email: "TeSt@Example.com",
      password: "1234567890",
    });

    expect(register.status).toBe(200);
    expect(register.body.ok).toBe(true);
    expect(register.body.user).toEqual({ id: 1, email: "test@example.com" });

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      ok: true,
      user: { id: 1, email: "test@example.com" },
    });
  });

  test("POST /auth/login returns 401 with contract error on invalid credentials", async () => {
    const agent = createTestAgent();

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
    const agent = createTestAgent();

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
    const agent = createTestAgent();

    const res = await agent.get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Not Logged in" });
  });

  test("POST /auth/logout returns 200 with { ok: true }", async () => {
    const agent = createTestAgent();

    await agent.post("/auth/register").send({
      email: "logout@example.com",
      password: "1234567890",
    });

    const res = await agent.post("/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

import request from "supertest";
import session from "express-session";
import { createApp } from "../server.js";

function createInMemoryUserPool() {
  const usersByEmail = new Map();
  const usersById = new Map();
  const authByUid = new Map();
  let nextId = 1;
  let nextAuthId = 1;

  const handleQuery = async (text, params = []) => {
    if (text.startsWith("BEGIN") || text.startsWith("COMMIT") || text.startsWith("ROLLBACK")) {
      return { rows: [] };
    }

    if (text.includes("INSERT INTO users")) {
      const [username, email] = params;
      if (usersByEmail.has(email)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }

      const user = { uid: nextId++, username: username ?? null, email };
      usersByEmail.set(email, user);
      usersById.set(user.uid, user);
      return { rows: [{ uid: user.uid, username: user.username, email: user.email }] };
    }

    if (text.includes("INSERT INTO auth")) {
      const [uid, passwordHash] = params;
      authByUid.set(uid, {
        auth_id: nextAuthId++,
        password_hash: passwordHash,
        account_lock: false,
        two_fa: false,
      });
      return { rows: [{ auth_id: authByUid.get(uid).auth_id }] };
    }

    if (text.includes("FROM users u") && text.includes("JOIN auth a") && text.includes("WHERE u.email = $1")) {
      const [email] = params;
      const user = usersByEmail.get(email);
      if (!user) return { rows: [] };

      const auth = authByUid.get(user.uid);
      if (!auth) return { rows: [] };

      return {
        rows: [
          {
            uid: user.uid,
            username: user.username,
            email: user.email,
            auth_id: auth.auth_id,
            password_hash: auth.password_hash,
            account_lock: auth.account_lock,
            two_fa: auth.two_fa,
          },
        ],
      };
    }

    if (text.startsWith("SELECT uid, email FROM users WHERE uid = $1")) {
      const [uid] = params;
      const user = usersById.get(uid);
      if (!user) return { rows: [] };
      return { rows: [{ uid: user.uid, email: user.email }] };
    }

    if (text.startsWith("SELECT 1 as ok")) {
      return { rows: [{ ok: 1 }] };
    }

    throw new Error(`Unexpected query in test pool: ${text}`);
  };

  return {
    async query(text, params = []) {
      return handleQuery(text, params);
    },
    async connect() {
      return {
        async query(text, params = []) {
          return handleQuery(text, params);
        },
        release() {},
      };
    },
  };
}

function createTestAgent() {
  const app = createApp({
    pool: createInMemoryUserPool(),
    sessionSecret: "test-secret",
    sessionStore: new session.MemoryStore(),
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

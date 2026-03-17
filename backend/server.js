import express from "express";
import session from "express-session";
import pg from "pg";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { priceTrackingRouter } from "./routes/priceTracking.js";

import {
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
  checkPsuWattageCompatibility,
  checkRamCapacityCompatibility,
} from "./compatibilityEngine.js";

// Keep dotenv quiet during tests to reduce noise in test output.
dotenv.config({ quiet: process.env.NODE_ENV === "test" });

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseAllowedOrigins(originsValue = process.env.FRONTEND_ORIGIN) {
  if (!originsValue) return [];

  return originsValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(app, allowedOrigins = parseAllowedOrigins()) {
  if (allowedOrigins.length === 0) return;

  const allowedOriginSet = new Set(allowedOrigins);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (!origin || !allowedOriginSet.has(origin)) {
      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.append("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });
}

function getSessionCookieConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredSameSite = process.env.SESSION_COOKIE_SAMESITE?.trim().toLowerCase();
  const validSameSite = new Set(["lax", "strict", "none"]);
  const sameSite = validSameSite.has(configuredSameSite)
    ? configuredSameSite
    : isProduction
      ? "none"
      : "lax";

  let secure = parseBooleanEnv(process.env.SESSION_COOKIE_SECURE, isProduction);
  if (sameSite === "none") {
    secure = true;
  }

  return {
    httpOnly: true,
    sameSite,
    secure,
    maxAge: 1000 * 60 * 60 * 8,
  };
}

function buildCompatibilityResponse(body = {}) {
  const { cpu, motherboard, ram, gpu, psu } = body;

  const cpuResult = checkCpuMotherboardCompatibility(cpu, motherboard);
  const ramTypeResult = checkRamMotherboardCompatibility(ram, motherboard);
  const psuResult = checkPsuWattageCompatibility(psu, cpu, gpu);
  const ramCapacityResult = checkRamCapacityCompatibility(ram, motherboard);

  const issues = [
    ...cpuResult.issues,
    ...ramTypeResult.issues,
    ...psuResult.issues,
    ...ramCapacityResult.issues,
  ];

  return {
    compatible: issues.length === 0,
    issues,
  };
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].trim();
  }

  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ ok: false, error: "Not Logged in" });
  }

  return next();
}

function createNoOpAuthLogger() {
  return {
    async logEvent() {},
    async getRecentEventsForUser() {
      return [];
    },
  };
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new pg.Pool({ connectionString });
}

function isSchemaMismatchError(error) {
  return ["42703", "42P01", "42704"].includes(error?.code);
}

async function createUserRecord(pool, email, passwordHash) {
  try {
    return await pool.query(
      `INSERT INTO users(email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email, passwordHash]
    );
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        `INSERT INTO users(username, email) VALUES ($1, $2) RETURNING uid AS id, email`,
        [null, email]
      );
      await client.query(`INSERT INTO auth(uid, password_hash) VALUES ($1, $2)`, [
        userResult.rows[0].id,
        passwordHash,
      ]);
      await client.query("COMMIT");
      return userResult;
    } catch (transactionError) {
      await client.query("ROLLBACK").catch(() => {});
      throw transactionError;
    } finally {
      client.release();
    }
  }
}

async function findUserByEmail(pool, email) {
  try {
    return await pool.query(`SELECT id, email, password_hash FROM users WHERE email = $1`, [email]);
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    return pool.query(
      `SELECT users.uid AS id, users.email, auth.password_hash
         FROM users
         JOIN auth ON auth.uid = users.uid
        WHERE users.email = $1`,
      [email]
    );
  }
}

async function findUserById(pool, userId) {
  try {
    return await pool.query("SELECT id, email FROM users WHERE id = $1", [userId]);
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    return pool.query("SELECT uid AS id, email FROM users WHERE uid = $1", [userId]);
  }
}

export async function ensureAuthLogTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      attempted_email TEXT,
      event_type TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      failure_reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function ensureSavedBuildTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_builds (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      title TEXT NOT NULL,
      total_price NUMERIC(10, 2),
      budget NUMERIC(10, 2),
      compatible BOOLEAN NOT NULL DEFAULT TRUE,
      performance_score INTEGER,
      parts JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_builds_user_created
      ON saved_builds(user_id, created_at DESC)
  `);
}

function normalizeSavedBuildRow(row) {
  return {
    id: row.id,
    title: row.title,
    totalPrice: row.total_price === null ? null : Number(row.total_price),
    budget: row.budget === null ? null : Number(row.budget),
    compatible: row.compatible,
    performanceScore: row.performance_score,
    parts: row.parts ?? {},
    createdAt: row.created_at,
  };
}

export function createAuthLogger(pool) {
  if (!pool) throw new Error("Pool is required");

  return {
    async logEvent({
                     authId = null,
                     attemptedEmail = null,
                     eventType,
                     success,
                     failureReason = null,
                     ipAddress = null,
                     userAgent = null,
                   }) {
      await pool.query(
          `INSERT INTO auth_logs
           (auth_id, attempted_email, event_type, success, failure_reason, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            authId,
            attemptedEmail,
            eventType,
            success,
            failureReason,
            ipAddress,
            userAgent,
          ]
      );
    },

    async getRecentEventsForEmail({ email, limit = 50 }) {
      const { rows } = await pool.query(
          `SELECT log_id, auth_id, attempted_email, event_type, success, failure_reason, ip_address,
                  user_agent, created_at
           FROM auth_logs
           WHERE attempted_email = $1
           ORDER BY created_at DESC
             LIMIT $2`,
          [email, limit]
      );

      return rows;
    },
  };
}

export function createSessionMiddleware(
  pool,
  sessionSecret = process.env.SESSION_SECRET,
  sessionStore
) {
  if (!sessionSecret) throw new Error("Session_secret missing!");

  const store =
    sessionStore ??
    new (connectPgSimple(session))({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });

  return session({
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  });
}

export function createApp({
  pool,
  bcryptLib = bcrypt,
  bcryptImpl,
  sessionMiddleware,
  sessionSecret = process.env.SESSION_SECRET,
  sessionStore,
  authLogger,
} = {}) {
  if (!pool) throw new Error("Pool is required");

  const resolvedBcrypt = bcryptImpl ?? bcryptLib;
  const resolvedSessionMiddleware =
    sessionMiddleware ?? createSessionMiddleware(pool, sessionSecret, sessionStore);
  const resolvedAuthLogger =
    authLogger ?? (process.env.NODE_ENV === "test" ? createNoOpAuthLogger() : createAuthLogger(pool));
  const safeLogAuthEvent = async (event) => {
    try {
      await resolvedAuthLogger.logEvent(event);
    } catch (loggingError) {
      console.error("Auth logging failed", loggingError);
    }
  };

  const app = express();
  const trustProxy = parseBooleanEnv(
    process.env.TRUST_PROXY,
    process.env.NODE_ENV === "production"
  );

  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  applyCors(app);

  app.use(express.json());
  app.use("/api", priceTrackingRouter);

  app.get("/", (req, res) => {
    res.type("text").send("ok");
  });

  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  app.post("/api/compatibility", (req, res) => {
    return res.json(buildCompatibilityResponse(req.body));
  });

  app.use(resolvedSessionMiddleware);

  app.post("/builds", requireAuth, async (req, res) => {
    const {
      title,
      totalPrice = null,
      budget = null,
      compatible = true,
      performanceScore = null,
      parts = {},
    } = req.body ?? {};

    if (!title || typeof title !== "string") {
      return res.status(400).json({ ok: false, error: "title required" });
    }

    if (!parts || typeof parts !== "object" || Array.isArray(parts)) {
      return res.status(400).json({ ok: false, error: "parts must be an object" });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO saved_builds
          (user_id, title, total_price, budget, compatible, performance_score, parts)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, total_price, budget, compatible, performance_score, parts, created_at`,
        [
          req.session.userId,
          title,
          totalPrice,
          budget,
          compatible,
          performanceScore,
          JSON.stringify(parts),
        ]
      );

      return res.json({ ok: true, build: normalizeSavedBuildRow(rows[0]) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.get("/builds/mine", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, total_price, budget, compatible, performance_score, parts, created_at
           FROM saved_builds
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [req.session.userId]
      );

      return res.json({ ok: true, builds: rows.map(normalizeSavedBuildRow) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.delete("/builds/:buildId", requireAuth, async (req, res) => {
    const buildId = Number(req.params.buildId);

    if (!Number.isInteger(buildId) || buildId <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid build id" });
    }

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM saved_builds
          WHERE id = $1 AND user_id = $2`,
        [buildId, req.session.userId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ ok: false, error: "Build not found" });
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.post("/auth/register", async (req, res) => {
    const { email, password, username } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email/password required" });
    }

    if (password.length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Password needs to be at least length of 10.",
      });
    }

    const normalizedEmail = typeof email === "string" ? email.toLowerCase() : null;
    const passwordHash = await bcryptLib.hash(password, 12);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
          `
            INSERT INTO users (username, email)
            VALUES ($1, $2)
              RETURNING uid, username, email
          `,
          [username ?? null, normalizedEmail]
      );

      const user = userResult.rows[0];

      const authResult = await client.query(
          `
      INSERT INTO auth (uid, password_hash)
      VALUES ($1, $2)
      RETURNING auth_id
      `,
          [user.uid, passwordHash]
      );

      const auth = authResult.rows[0];

      await client.query("COMMIT");

      req.session.userId = user.uid;

      await resolvedAuthLogger.logEvent({
        authId: auth.auth_id,
        attemptedEmail: user.email,
        eventType: "register",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user,
      });
    } catch (e) {
      await client.query("ROLLBACK");

      if (e.code === "23505") {
        await resolvedAuthLogger.logEvent({
          attemptedEmail: normalizedEmail,
          eventType: "register",
          success: false,
          failureReason: "email_exists",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(409).json({ ok: false, error: "Email already exists" });
      }

      await safeLogAuthEvent({
        attemptedEmail: normalizedEmail,
        eventType: "register",
        success: false,
        failureReason: "server_error",
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const normalizedEmail = typeof email === "string" ? email.toLowerCase() : null;

      if (!email || !password) {
        await resolvedAuthLogger.logEvent({
          attemptedEmail: normalizedEmail,
          eventType: "login",
          success: false,
          failureReason: "missing_credentials",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res
            .status(400)
            .json({ ok: false, error: "email/password required" });
      }

      const { rows } = await pool.query(
          `
      SELECT
        u.uid,
        u.username,
        u.email,
        a.auth_id,
        a.password_hash,
        a.account_lock,
        a.two_fa
      FROM users u
      JOIN auth a ON u.uid = a.uid
      WHERE u.email = $1
      `,
          [normalizedEmail]
      );

      if (rows.length === 0) {
        await safeLogAuthEvent({
          attemptedEmail: normalizedEmail,
          eventType: "login",
          success: false,
          failureReason: "invalid_credentials",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      const user = rows[0];
      const ok = await resolvedBcrypt.compare(password, user.password_hash);

      if (user.account_lock) {
        await resolvedAuthLogger.logEvent({
          authId: user.auth_id,
          attemptedEmail: user.email,
          eventType: "login",
          success: false,
          failureReason: "account_locked",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(403).json({ ok: false, error: "Account locked" });
      }

      const ok = await bcryptLib.compare(password, user.password_hash);

      if (!ok) {
        await resolvedAuthLogger.logEvent({
          authId: user.auth_id,
          attemptedEmail: user.email,
          eventType: "login",
          success: false,
          failureReason: "invalid_credentials",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      req.session.userId = user.uid;

      await resolvedAuthLogger.logEvent({
        authId: user.auth_id,
        attemptedEmail: user.email,
        eventType: "login",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user: {
          uid: user.uid,
          username: user.username,
          email: user.email,
        },
      });
    } catch (e) {
      await safeLogAuthEvent({
        attemptedEmail:
            typeof req.body?.email === "string" ? req.body.email.toLowerCase() : null,
        eventType: "login",
        success: false,
        failureReason: "server_error",
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.get("/auth/me", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT uid, email FROM users WHERE uid = $1",
        [req.session.userId]
      );
      return res.json({ ok: true, user: rows[0] });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.post("/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ ok: false, error: "Logout failed" });

      res.clearCookie("connect.sid");
      return res.json({ ok: true });
    });
  });

  app.get("/auth/logs", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
          "SELECT uid, email FROM users WHERE uid = $1",
          [req.session.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const logs = await resolvedAuthLogger.getRecentEventsForEmail({
        email: rows[0].email,
      });

      return res.json({ ok: true, logs });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.get("/health", async (req, res) => {
    try {
      const r = await pool.query("SELECT 1 as ok");
      res.json({ ok: true, db: r.rows[0].ok });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "db down" });
    }
  });

  return app;
}

export function startServer({
  port = process.env.PORT ?? 3001,
  pool = createPool(),
  sessionMiddleware,
  bcryptLib = bcrypt,
  bcryptImpl,
  authLogger,
  sessionSecret = process.env.SESSION_SECRET,
  sessionStore,
} = {}) {


  const app = createApp({
    pool,
    sessionMiddleware:
      sessionMiddleware ?? createSessionMiddleware(pool, sessionSecret, sessionStore),
    bcryptLib,
    bcryptImpl,
    authLogger: authLogger ?? createAuthLogger(pool),
    sessionSecret,
    sessionStore,
  });

  return app.listen(port, () => {
    console.log(`Listening on ${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

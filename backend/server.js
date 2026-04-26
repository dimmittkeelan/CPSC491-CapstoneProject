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
    async getRecentEventsForEmail() {
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

function coerceIdentifier(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) ? numericValue : value;
}

function normalizeUserResponse(row) {
  return {
    id: coerceIdentifier(row.id),
    email: row.email,
  };
}

async function createUserRecord(pool, email, passwordHash, username = null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users(username, email)
       VALUES ($1, $2)
       RETURNING uid AS id, email`,
      [username, email]
    );
    const user = userResult.rows[0];

    const authResult = await client.query(
      `INSERT INTO auth(uid, password_hash)
       VALUES ($1, $2)
       RETURNING auth_id`,
      [user.id, passwordHash]
    );

    await client.query("COMMIT");

    return {
      user,
      authId: authResult.rows[0].auth_id,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function findUserByEmail(pool, email) {
  return pool.query(
    `SELECT
        u.uid AS id,
        u.email,
        a.auth_id,
        a.password_hash,
        a.account_lock,
        a.two_fa
      FROM users u
      JOIN auth a ON a.uid = u.uid
      WHERE u.email = $1`,
    [email]
  );
}

async function findUserById(pool, userId) {
  return pool.query("SELECT uid AS id, email FROM users WHERE uid = $1", [userId]);
}

export async function ensureAuthLogTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_logs (
      log_id BIGSERIAL PRIMARY KEY,
      auth_id BIGINT REFERENCES auth(auth_id) ON DELETE CASCADE,
      uid BIGINT REFERENCES auth(uid) ON DELETE SET NULL,
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
    CREATE TABLE IF NOT EXISTS builds (
      build_id BIGSERIAL PRIMARY KEY,
      uid BIGINT REFERENCES users(uid) ON DELETE CASCADE,
      price DECIMAL(10, 2),
      validated BOOLEAN DEFAULT FALSE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS build_pc_parts (
      junction_id BIGSERIAL PRIMARY KEY,
      build_id BIGINT NOT NULL REFERENCES builds(build_id) ON DELETE CASCADE,
      sku BIGINT NOT NULL REFERENCES pc_parts(sku) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_builds_uid_build_id
      ON builds(uid, build_id DESC)
  `);
}

function normalizePartTypeKey(type, fallbackKey = "part") {
  const normalizedType = typeof type === "string" ? type.trim().toLowerCase() : "";

  if (!normalizedType) {
    return fallbackKey;
  }

  if (normalizedType === "motherboard") {
    return "mobo";
  }

  if (normalizedType === "graphics card") {
    return "gpu";
  }

  if (normalizedType === "power supply") {
    return "psu";
  }

  return normalizedType;
}

function setPartRecord(parts, key, record) {
  if (!parts[key]) {
    parts[key] = record;
    return;
  }

  let index = 2;
  while (parts[`${key}_${index}`]) {
    index += 1;
  }

  parts[`${key}_${index}`] = record;
}

function buildPartsPayload(partRows = []) {
  const parts = {};

  for (const row of partRows) {
    if (!row?.sku || !row?.name) {
      continue;
    }

    const partKey = normalizePartTypeKey(row.type, "part");

    setPartRecord(parts, partKey, {
      sku: coerceIdentifier(row.sku),
      name: row.name,
      price: row.part_price === null || row.part_price === undefined ? null : Number(row.part_price),
    });
  }

  return parts;
}

function deriveBuildTitle(parts = {}, fallbackId) {
  const preferredParts = [parts.cpu?.name, parts.gpu?.name].filter(Boolean);

  if (preferredParts.length === 2) {
    return `${preferredParts[0]} + ${preferredParts[1]}`;
  }

  const firstNamedPart = Object.values(parts)
    .map((part) => part?.name)
    .find(Boolean);

  if (firstNamedPart) {
    return firstNamedPart;
  }

  return `Build #${fallbackId}`;
}

function normalizeBuildPayload({
  buildId,
  price,
  validated,
  parts = {},
  title = null,
  budget = null,
  performanceScore = null,
  createdAt = null,
}) {
  return {
    id: coerceIdentifier(buildId),
    title: title || deriveBuildTitle(parts, buildId),
    totalPrice: price === null || price === undefined ? null : Number(price),
    budget,
    compatible: Boolean(validated),
    performanceScore,
    parts,
    createdAt,
  };
}

function normalizeBuildRows(rows = []) {
  const builds = new Map();

  for (const row of rows) {
    const buildId = row.build_id;

    if (!builds.has(buildId)) {
      builds.set(buildId, {
        buildId,
        price: row.price,
        validated: row.validated,
        partRows: [],
      });
    }

    if (row.sku && row.name) {
      builds.get(buildId).partRows.push(row);
    }
  }

  return Array.from(builds.values()).map((build) =>
    normalizeBuildPayload({
      buildId: build.buildId,
      price: build.price,
      validated: build.validated,
      parts: buildPartsPayload(build.partRows),
    })
  );
}

async function resolvePcPart(client, part, fallbackTypeKey) {
  if (!part || typeof part !== "object") {
    return null;
  }

  if (part.sku !== undefined && part.sku !== null) {
    const { rows } = await client.query(
      `SELECT sku, type, name, price AS part_price
       FROM pc_parts
       WHERE sku = $1`,
      [part.sku]
    );

    if (rows[0]) {
      return rows[0];
    }
  }

  if (typeof part.name !== "string" || !part.name.trim()) {
    return null;
  }

  const { rows } = await client.query(
    `SELECT sku, type, name, price AS part_price
     FROM pc_parts
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [part.name.trim()]
  );

  if (rows[0]) {
    return rows[0];
  }

  return {
    sku: null,
    type: fallbackTypeKey,
    name: part.name.trim(),
    part_price: part.price ?? null,
  };
}

async function attachBuildParts(client, buildId, parts = {}) {
  const attachedParts = {};

  for (const [requestedKey, part] of Object.entries(parts)) {
    const resolvedPart = await resolvePcPart(client, part, requestedKey);

    if (!resolvedPart) {
      continue;
    }

    if (resolvedPart.sku !== null) {
      await client.query(
        `INSERT INTO build_pc_parts(build_id, sku)
         VALUES ($1, $2)`,
        [buildId, resolvedPart.sku]
      );
    }

    setPartRecord(attachedParts, normalizePartTypeKey(resolvedPart.type, requestedKey), {
      sku: resolvedPart.sku === null ? null : coerceIdentifier(resolvedPart.sku),
      name: resolvedPart.name,
      price:
        resolvedPart.part_price === null || resolvedPart.part_price === undefined
          ? null
          : Number(resolvedPart.part_price),
    });
  }

  return attachedParts;
}

export function createAuthLogger(pool) {
  if (!pool) throw new Error("Pool is required");

  return {
    async logEvent({
      authId = null,
      userId = null,
      attemptedEmail = null,
      eventType,
      success,
      failureReason = null,
      ipAddress = null,
      userAgent = null,
    }) {
      await pool.query(
        `INSERT INTO auth_logs
         (auth_id, uid, attempted_email, event_type, success, failure_reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          authId,
          userId,
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
        `SELECT log_id, auth_id, uid, attempted_email, event_type, success, failure_reason, ip_address,
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

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO builds(uid, price, validated)
         VALUES ($1, $2, $3)
         RETURNING build_id, price, validated`,
        [
          req.session.userId,
          totalPrice,
          compatible,
        ]
      );

      const build = rows[0];
      const attachedParts = await attachBuildParts(client, build.build_id, parts);

      await client.query("COMMIT");

      return res.json({
        ok: true,
        build: normalizeBuildPayload({
          buildId: build.build_id,
          price: build.price,
          validated: build.validated,
          parts: attachedParts,
          title,
          budget,
          performanceScore,
        }),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(error);
      return res.status(500).json({ ok: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  app.get("/builds/mine", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
            b.build_id,
            b.price,
            b.validated,
            bp.junction_id,
            p.sku,
            p.type,
            p.name,
            p.price AS part_price
          FROM builds b
          LEFT JOIN build_pc_parts bp ON bp.build_id = b.build_id
          LEFT JOIN pc_parts p ON p.sku = bp.sku
          WHERE b.uid = $1
          ORDER BY b.build_id DESC, bp.junction_id ASC`,
        [req.session.userId]
      );

      return res.json({ ok: true, builds: normalizeBuildRows(rows) });
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
        `DELETE FROM builds
         WHERE build_id = $1 AND uid = $2`,
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
    const passwordHash = await resolvedBcrypt.hash(password, 12);

    try {
      const { user, authId } = await createUserRecord(
        pool,
        normalizedEmail,
        passwordHash,
        username ?? null
      );

      req.session.userId = coerceIdentifier(user.id);

      await resolvedAuthLogger.logEvent({
        authId,
        userId: user.id,
        attemptedEmail: user.email,
        eventType: "register",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user: normalizeUserResponse(user),
      });
    } catch (e) {
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

      const { rows } = await findUserByEmail(pool, normalizedEmail);

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

      if (user.account_lock) {
        await resolvedAuthLogger.logEvent({
          authId: user.auth_id,
          userId: user.id,
          attemptedEmail: user.email,
          eventType: "login",
          success: false,
          failureReason: "account_locked",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(403).json({ ok: false, error: "Account locked" });
      }

      const ok = await resolvedBcrypt.compare(password, user.password_hash);

      if (!ok) {
        await resolvedAuthLogger.logEvent({
          authId: user.auth_id,
          userId: user.id,
          attemptedEmail: user.email,
          eventType: "login",
          success: false,
          failureReason: "invalid_credentials",
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") ?? null,
        });

        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      req.session.userId = coerceIdentifier(user.id);

      await resolvedAuthLogger.logEvent({
        authId: user.auth_id,
        userId: user.id,
        attemptedEmail: user.email,
        eventType: "login",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user: normalizeUserResponse(user),
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
      const { rows } = await findUserById(pool, req.session.userId);
      return res.json({ ok: true, user: rows[0] ? normalizeUserResponse(rows[0]) : null });
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
      const { rows } = await findUserById(pool, req.session.userId);

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

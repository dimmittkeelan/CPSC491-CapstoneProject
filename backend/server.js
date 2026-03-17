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

// Check if server is being ran by test suite
dotenv.config({ quiet: process.env.NODE_ENV === "test" });

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

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new pg.Pool({ connectionString });
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
  sessionSecret = process.env.SESSION_SECRET
) {
  if (!sessionSecret) throw new Error("Session_secret missing!");

  const PgSession = connectPgSimple(session);

  return session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
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

function requireAuth(req, res, next) {
  if (!req.session?.userId)
    return res.status(401).json({ ok: false, error: "Not Logged in" });
  return next();
}

// Build app for tests
export function createApp({
  pool,
  bcryptLib = bcrypt,
  sessionMiddleware,
  authLogger,
} = {}) {
  if (!pool) throw new Error("Pool is required");
  const resolvedSessionMiddleware =
    sessionMiddleware ?? createSessionMiddleware(pool);
  const resolvedAuthLogger = authLogger ?? createAuthLogger(pool);

  const app = express();
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

      await resolvedAuthLogger.logEvent({
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
        await resolvedAuthLogger.logEvent({
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
      await resolvedAuthLogger.logEvent({
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
  authLogger,
} = {}) {


  const app = createApp({
    pool,
    sessionMiddleware: sessionMiddleware ?? createSessionMiddleware(pool),
    bcryptLib,
    authLogger: authLogger ?? createAuthLogger(pool),
  });

  return app.listen(port, () => {
    console.log(`Listening on ${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

import express from "express";
import session from "express-session";
import pg from "pg";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import { priceTrackingRouter } from "./routes/priceTracking.js";

import {
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
  checkPsuWattageCompatibility,
  checkRamCapacityCompatibility,
} from "./compatibilityEngine.js";

dotenv.config();

export function createApp({
  pool,
  sessionSecret = process.env.SESSION_SECRET,
  sessionStore,
  bcryptImpl = bcrypt,
} = {}) {
  if (!sessionSecret) throw new Error("Session_secret missing!");

  const app = express();
  app.use(express.json());
  app.use("/api", priceTrackingRouter);

  const resolvedPool =
    pool ??
    new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });

  const resolvedSessionStore =
    sessionStore ??
    new (connectPgSimple(session))({
      pool: resolvedPool,
      tableName: "session",
      createTableIfMissing: true,
    });

  app.use(
    session({
      store: resolvedSessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 8,
      },
    })
  );

  app.get("/", (req, res) => {
    res.type("text").send("ok");
  });

  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  app.post("/api/compatibility", (req, res) => {
    const { cpu, motherboard, ram, gpu, psu } = req.body ?? {};

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

    const compatible = issues.length === 0;

    return res.json({ compatible, issues });
  });

  function requireAuth(req, res, next) {
    if (!req.session?.userId)
      return res.status(401).json({ ok: false, error: "Not Logged in" });
    return next();
  }

  app.post("/auth/register", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password)
      return res.status(400).json({ ok: false, error: "email/password required" });
    if (password.length < 10)
      return res
        .status(400)
        .json({ ok: false, error: "Password needs to be at least length of 10." });

    const passwordHash = await bcryptImpl.hash(password, 12);

    try {
      const result = await resolvedPool.query(
        `INSERT INTO users(email, password_hash) VALUES ($1, $2) RETURNING id, email`,
        [email.toLowerCase(), passwordHash]
      );

      req.session.userId = result.rows[0].id;
      return res.json({ ok: true, user: result.rows[0] });
    } catch (e) {
      if (e.code === "23505")
        return res.status(409).json({ ok: false, error: "Email already exists" });

      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password)
        return res.status(400).json({ ok: false, error: "email/password required" });

      const { rows } = await resolvedPool.query(
        `SELECT id, email, password_hash FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (rows.length === 0)
        return res.status(401).json({ ok: false, error: "Invalid credentials" });

      const user = rows[0];
      const ok = await bcryptImpl.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      return res.json({ ok: true, user: { id: user.id, email: user.email } });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.get("/auth/me", requireAuth, async (req, res) => {
    try {
      const { rows } = await resolvedPool.query("SELECT id, email FROM users WHERE id = $1", [
        req.session.userId,
      ]);
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

  app.get("/health", async (req, res) => {
    try {
      const r = await resolvedPool.query("SELECT 1 as ok");
      res.json({ ok: true, db: r.rows[0].ok });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "db down" });
    }
  });

  return app;
}

const defaultSessionSecret =
  process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "test" ? "test-secret" : undefined);

export const app = createApp({ sessionSecret: defaultSessionSecret });

if (process.env.NODE_ENV !== "test") {
  const port = process.env.PORT ?? 3001;
  app.listen(port, () => {
    console.log(`Listening on ${port}`);
  });
}
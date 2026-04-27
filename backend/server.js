import express from "express";
import session from "express-session";
import pg from "pg";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { priceTrackingRouter } from "./routes/priceTracking.js";
import fetch from "node-fetch";

import {
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
  checkPsuWattageCompatibility,
  checkRamCapacityCompatibility,
} from "./compatibilityEngine.js";

// Keep dotenv quiet during tests to reduce noise in test output.
dotenv.config({ quiet: process.env.NODE_ENV === "test" });

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "connect.sid";

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
  const validSameSite = new Set(["none"]);
  const sameSite = validSameSite.has(configuredSameSite)
    ? configuredSameSite
    : isProduction
      ? "none"
      : "none";

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
      log_id BIGSERIAL PRIMARY KEY,
      auth_id BIGINT REFERENCES auth(auth_id) ON DELETE CASCADE,
      uid INTEGER REFERENCES auth(uid) ON DELETE SET NULL,
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
      user_id INTEGER NOT NULL,
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
                     userId = null,
                     attemptedEmail = null,
                     eventType,
                     success,
                     failureReason = null,
                     ipAddress = null,
                     userAgent = null,
                   }) {
      const { rows: authRows } = await pool.query(
        `
          SELECT a.auth_id, a.uid
          FROM auth a
          LEFT JOIN users u ON u.uid = a.uid
          WHERE ($1::bigint IS NOT NULL AND a.uid = $1)
             OR ($1::bigint IS NULL AND $2::text IS NOT NULL AND u.email = $2)
          ORDER BY a.auth_id ASC
          LIMIT 1
        `,
        [userId, attemptedEmail]
      );

      const authRow = authRows[0];

      if (!authRow?.auth_id) {
        return;
      }

      await pool.query(
          `INSERT INTO auth_logs
           (auth_id, uid, attempted_email, event_type, success, failure_reason, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            authRow.auth_id,
            authRow.uid,
            attemptedEmail,
            eventType,
            success,
            failureReason,
            ipAddress,
            userAgent,
          ]
      );
    },

    async getRecentEventsForUser({ userId, limit = 50 }) {
      const { rows } = await pool.query(
          `SELECT log_id, auth_id, uid, attempted_email, event_type, success, failure_reason, ip_address,
                  user_agent, created_at
           FROM auth_logs
           WHERE uid = $1
           ORDER BY created_at DESC
             LIMIT $2`,
          [userId, limit]
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
    name: SESSION_COOKIE_NAME,
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "none",
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

  const PARTS_CATALOG = {
    cpu: [
      { id: "cpu-1",  name: "AMD Ryzen 5 5600X",    price: 199, tdp: 65,  socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i5-12400F" },
      { id: "cpu-2",  name: "AMD Ryzen 7 5800X",    price: 299, tdp: 105, socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i7-12700F" },
      { id: "cpu-3",  name: "AMD Ryzen 9 5900X",    price: 399, tdp: 105, socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i9-12900K" },
      { id: "cpu-4",  name: "AMD Ryzen 5 7600X",    price: 249, tdp: 105, socket: "AM5",     img: "https://via.placeholder.com/56", alt: "Intel i5-13600K" },
      { id: "cpu-5",  name: "AMD Ryzen 7 7700X",    price: 349, tdp: 105, socket: "AM5",     img: "https://via.placeholder.com/56", alt: "Intel i7-13700K" },
      { id: "cpu-6",  name: "Intel Core i5-12400F", price: 169, tdp: 65,  socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 5 5600X" },
      { id: "cpu-7",  name: "Intel Core i5-13600K", price: 279, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 5 7600X" },
      { id: "cpu-8",  name: "Intel Core i7-12700F", price: 289, tdp: 65,  socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 7 5800X" },
      { id: "cpu-9",  name: "Intel Core i7-13700K", price: 379, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 7 7700X" },
      { id: "cpu-10", name: "Intel Core i9-13900K", price: 549, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 9 7950X" },
    ],
    gpu: [
      { id: "gpu-1",  name: "NVIDIA RTX 3060",        price: 329, tdp: 170, img: "https://via.placeholder.com/56", alt: "AMD RX 6600" },
      { id: "gpu-2",  name: "NVIDIA RTX 3060 Ti",     price: 399, tdp: 200, img: "https://via.placeholder.com/56", alt: "AMD RX 6700 XT" },
      { id: "gpu-3",  name: "NVIDIA RTX 3070",        price: 499, tdp: 220, img: "https://via.placeholder.com/56", alt: "AMD RX 6800" },
      { id: "gpu-4",  name: "NVIDIA RTX 3080",        price: 699, tdp: 320, img: "https://via.placeholder.com/56", alt: "AMD RX 6800 XT" },
      { id: "gpu-5",  name: "NVIDIA RTX 4060",        price: 299, tdp: 115, img: "https://via.placeholder.com/56", alt: "AMD RX 7600" },
      { id: "gpu-6",  name: "NVIDIA RTX 4070",        price: 599, tdp: 200, img: "https://via.placeholder.com/56", alt: "AMD RX 7800 XT" },
      { id: "gpu-7",  name: "AMD Radeon RX 6600",     price: 249, tdp: 132, img: "https://via.placeholder.com/56", alt: "RTX 3060" },
      { id: "gpu-8",  name: "AMD Radeon RX 6700 XT",  price: 349, tdp: 230, img: "https://via.placeholder.com/56", alt: "RTX 3060 Ti" },
      { id: "gpu-9",  name: "AMD Radeon RX 6800 XT",  price: 549, tdp: 300, img: "https://via.placeholder.com/56", alt: "RTX 3080" },
      { id: "gpu-10", name: "AMD Radeon RX 7900 XTX", price: 949, tdp: 355, img: "https://via.placeholder.com/56", alt: "RTX 4080" },
    ],
    ram: [
      { id: "ram-1", name: "Corsair Vengeance 16GB DDR4-3200", price: 45,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "G.Skill Ripjaws 16GB DDR4" },
      { id: "ram-2", name: "G.Skill Ripjaws 16GB DDR4-3600",  price: 55,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Vengeance 16GB DDR4" },
      { id: "ram-3", name: "Kingston Fury 32GB DDR4-3200",    price: 79,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Vengeance 32GB DDR4" },
      { id: "ram-4", name: "Corsair Vengeance 32GB DDR4-3600",price: 95,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "G.Skill Ripjaws 32GB DDR4" },
      { id: "ram-5", name: "G.Skill Trident 64GB DDR4-3600",  price: 159, type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Dominator 64GB DDR4" },
      { id: "ram-6", name: "Corsair Vengeance 16GB DDR5-4800",price: 75,  type: "DDR5", img: "https://via.placeholder.com/56", alt: "Kingston Fury 16GB DDR5" },
      { id: "ram-7", name: "G.Skill Trident 32GB DDR5-6000",  price: 119, type: "DDR5", img: "https://via.placeholder.com/56", alt: "Corsair Dominator 32GB DDR5" },
      { id: "ram-8", name: "Kingston Fury 32GB DDR5-5200",    price: 109, type: "DDR5", img: "https://via.placeholder.com/56", alt: "G.Skill Trident 32GB DDR5" },
      { id: "ram-9", name: "Corsair Dominator 64GB DDR5-5600",price: 229, type: "DDR5", img: "https://via.placeholder.com/56", alt: "G.Skill Trident 64GB DDR5" },
    ],
    mobo: [
      { id: "mobo-1",  name: "MSI B550-A Pro",             price: 129, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "ASUS TUF B550-Plus" },
      { id: "mobo-2",  name: "ASUS TUF B550-Plus",         price: 149, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI B550-A Pro" },
      { id: "mobo-3",  name: "ASUS ROG STRIX B550-F",      price: 180, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI B550 Tomahawk" },
      { id: "mobo-4",  name: "MSI B550 Tomahawk",          price: 159, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "Gigabyte B550 Aorus" },
      { id: "mobo-5",  name: "ASUS ROG Crosshair X670E",   price: 349, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI X670E Tomahawk" },
      { id: "mobo-6",  name: "MSI X670E Tomahawk",         price: 299, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "ASUS ROG Crosshair X670E" },
      { id: "mobo-7",  name: "Gigabyte B650 Aorus Elite",  price: 199, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI B650 Tomahawk" },
      { id: "mobo-8",  name: "ASUS Prime Z690-A",          price: 219, socket: "LGA1700", ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI Z690-A Pro" },
      { id: "mobo-9",  name: "MSI Z690-A Pro",             price: 189, socket: "LGA1700", ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "ASUS Prime Z690-A" },
      { id: "mobo-10", name: "ASUS ROG Strix Z790-E",      price: 399, socket: "LGA1700", ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI Z790 Edge" },
      { id: "mobo-11", name: "MSI Z790 Edge",              price: 329, socket: "LGA1700", ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "ASUS ROG Strix Z790-E" },
    ],
    psu: [
      { id: "psu-1",  name: "EVGA 500W Bronze",          price: 49,  wattage: 500,  img: "https://via.placeholder.com/56", alt: "Corsair CV550" },
      { id: "psu-2",  name: "Corsair CV550",             price: 59,  wattage: 550,  img: "https://via.placeholder.com/56", alt: "EVGA 500W Bronze" },
      { id: "psu-3",  name: "Corsair CX650M",            price: 79,  wattage: 650,  img: "https://via.placeholder.com/56", alt: "EVGA 650W Gold" },
      { id: "psu-4",  name: "EVGA 650W Gold",            price: 89,  wattage: 650,  img: "https://via.placeholder.com/56", alt: "Corsair CX650M" },
      { id: "psu-5",  name: "Seasonic Focus GX-750",     price: 129, wattage: 750,  img: "https://via.placeholder.com/56", alt: "Corsair RM750x" },
      { id: "psu-6",  name: "Corsair RM750x",            price: 119, wattage: 750,  img: "https://via.placeholder.com/56", alt: "Seasonic Focus GX-750" },
      { id: "psu-7",  name: "be quiet! Pure Power 850W", price: 139, wattage: 850,  img: "https://via.placeholder.com/56", alt: "Corsair RM850x" },
      { id: "psu-8",  name: "Corsair RM850x",            price: 149, wattage: 850,  img: "https://via.placeholder.com/56", alt: "be quiet! Pure Power 850W" },
      { id: "psu-9",  name: "Seasonic Focus GX-1000",    price: 189, wattage: 1000, img: "https://via.placeholder.com/56", alt: "Corsair HX1000" },
      { id: "psu-10", name: "Corsair HX1000",            price: 199, wattage: 1000, img: "https://via.placeholder.com/56", alt: "Seasonic Focus GX-1000" },
    ],
  };

  function recommendBuild(budget) {
    // Budget split: GPU gets the most, then CPU, mobo, psu, ram
    const alloc = { gpu: 0.38, cpu: 0.22, mobo: 0.18, psu: 0.12, ram: 0.10 };

    // Sort each category best (most expensive) first
    const sorted = {};
    for (const [cat, parts] of Object.entries(PARTS_CATALOG)) {
      sorted[cat] = [...parts].sort((a, b) => b.price - a.price);
    }

    // Pick best GPU within allocation
    const gpu = sorted.gpu.find(p => p.price <= budget * alloc.gpu)
      ?? sorted.gpu[sorted.gpu.length - 1];

    // Pick best CPU within allocation
    const cpu = sorted.cpu.find(p => p.price <= budget * alloc.cpu)
      ?? sorted.cpu[sorted.cpu.length - 1];

    // Pick best Mobo that matches CPU socket
    const mobo = sorted.mobo.find(p => p.socket === cpu.socket && p.price <= budget * alloc.mobo)
      ?? sorted.mobo.find(p => p.socket === cpu.socket);

    // Pick best RAM that matches Mobo RAM type
    const ram = sorted.ram.find(p => p.type === mobo.ramType && p.price <= budget * alloc.ram)
      ?? sorted.ram.find(p => p.type === mobo.ramType);

    // Pick PSU that covers CPU + GPU + mobo overhead with 20% headroom
    const requiredWattage = Math.ceil((cpu.tdp + gpu.tdp + 35) * 1.2);
    const psu = sorted.psu.find(p => p.wattage >= requiredWattage && p.price <= budget * alloc.psu)
      ?? sorted.psu.find(p => p.wattage >= requiredWattage)
      ?? sorted.psu[sorted.psu.length - 1];

    return { cpu, gpu, ram, mobo, psu };
  }

  app.get("/api/parts", (req, res) => {
    return res.json({ ok: true, parts: PARTS_CATALOG });
  });

  app.post("/api/recommend", (req, res) => {
    const budget = Number(req.body?.budget);

    if (!budget || budget <= 0) {
      return res.status(400).json({ ok: false, error: "Valid budget is required" });
    }

    const parts = recommendBuild(budget);
    const totalPrice = Object.values(parts).reduce((sum, p) => sum + (p?.price ?? 0), 0);

    return res.json({ ok: true, parts, totalPrice });
  });

  app.post("/api/build-analysis", (req, res) => {
    const { cpu, motherboard, ram, gpu, psu } = req.body ?? {};

    const compatibility = buildCompatibilityResponse(req.body);

    const estimatedPower =
      (typeof cpu?.tdp === "number" ? cpu.tdp : 0) +
      (typeof gpu?.tdp === "number" ? gpu.tdp : 0) +
      100;

    return res.json({
      ...compatibility,
      estimatedPower,
      parts: {
        cpu,
        motherboard,
        ram,
        gpu,
        psu,
      },
    });
  });

  app.get("/api/external-products", async (req, res) => {
    try {
      const response = await fetch("https://dummyjson.com/products?limit=5");
      const data = await response.json();

      return res.json({
        ok: true,
        products: data.products,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "Failed to fetch external data" });
    }
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

      await safeLogAuthEvent({
        userId: user.uid,
        attemptedEmail: user.email,
        eventType: "register",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user: {
          id: user.uid,
          email: user.email,
        },
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}

      if (e.code === "23505") {
        await safeLogAuthEvent({
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
        await safeLogAuthEvent({
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
      //const ok = await resolvedBcrypt.compare(password, user.password_hash);

      if (user.account_lock) {
        await safeLogAuthEvent({
          userId: user.uid,
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
        await safeLogAuthEvent({
          userId: user.uid,
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

      await safeLogAuthEvent({
        userId: user.uid,
        attemptedEmail: user.email,
        eventType: "login",
        success: true,
        ipAddress: getClientIp(req),
        userAgent: req.get("user-agent") ?? null,
      });

      return res.json({
        ok: true,
        user: {
          id: user.uid,
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
      return res.json({
        ok: true,
        user: {
          id: rows[0].uid,
          email: rows[0].email,
        },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.post("/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ ok: false, error: "Logout failed" });

      res.clearCookie(SESSION_COOKIE_NAME);
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

      const logs = await resolvedAuthLogger.getRecentEventsForUser({
        userId: req.session.userId,
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

import pg from "pg";

const SCHEMA_SQL = `
DROP TABLE IF EXISTS build_pc_parts CASCADE;
DROP TABLE IF EXISTS builds CASCADE;
DROP TABLE IF EXISTS auth_logs CASCADE;
DROP TABLE IF EXISTS pc_parts CASCADE;
DROP TABLE IF EXISTS auth CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  uid BIGSERIAL PRIMARY KEY,
  username VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE
);

CREATE TABLE auth (
  auth_id BIGSERIAL PRIMARY KEY,
  uid BIGINT UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_lock BOOLEAN DEFAULT FALSE,
  two_fa BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_auth_user
    FOREIGN KEY (uid)
    REFERENCES users(uid)
    ON DELETE CASCADE
);

CREATE TABLE auth_logs (
  log_id BIGSERIAL PRIMARY KEY,
  auth_id BIGINT NOT NULL,
  uid BIGINT REFERENCES auth(uid) ON DELETE SET NULL,
  attempted_email TEXT,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_auth_logs
    FOREIGN KEY (auth_id)
    REFERENCES auth(auth_id)
    ON DELETE CASCADE
);

CREATE TABLE pc_parts (
  sku BIGSERIAL PRIMARY KEY,
  type VARCHAR(255),
  price DECIMAL(10, 2),
  name VARCHAR(255),
  inventory BIGINT
);

CREATE TABLE builds (
  build_id BIGSERIAL PRIMARY KEY,
  uid BIGINT,
  price DECIMAL(10, 2),
  validated BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_build_user
    FOREIGN KEY (uid)
    REFERENCES users(uid)
    ON DELETE CASCADE
);

CREATE TABLE build_pc_parts (
  junction_id BIGSERIAL PRIMARY KEY,
  build_id BIGINT NOT NULL,
  sku BIGINT NOT NULL,
  CONSTRAINT fk_build
    FOREIGN KEY (build_id)
    REFERENCES builds(build_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_part
    FOREIGN KEY (sku)
    REFERENCES pc_parts(sku)
    ON DELETE CASCADE
);
`;

export function getIntegrationDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Set TEST_DATABASE_URL or DATABASE_URL before running integration tests.");
  }

  return databaseUrl;
}

export function createIntegrationPool() {
  return new pg.Pool({ connectionString: getIntegrationDatabaseUrl() });
}

export async function applyIntegrationSchema(pool) {
  await pool.query(SCHEMA_SQL);
}

export async function truncateIntegrationTables(pool) {
  await pool.query(`
    TRUNCATE TABLE build_pc_parts, builds, auth_logs, pc_parts, auth, users
    RESTART IDENTITY CASCADE
  `);
}

export async function seedPcParts(pool, parts) {
  const inserted = [];

  for (const part of parts) {
    const { rows } = await pool.query(
      `
        INSERT INTO pc_parts (type, price, name, inventory)
        VALUES ($1, $2, $3, $4)
        RETURNING sku, type, price, name, inventory
      `,
      [part.type, part.price, part.name, part.inventory ?? 1]
    );
    inserted.push(rows[0]);
  }

  return inserted;
}

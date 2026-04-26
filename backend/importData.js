import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const categories = [
  { file: "cpu.json", category: "cpu" },
  { file: "video-card.json", category: "gpu" },
  { file: "memory.json", category: "ram" },
  { file: "motherboard.json", category: "motherboard" },
  { file: "power-supply.json", category: "psu" },
];

async function importData() {
  try {
    for (const { file, category } of categories) {
      const filePath = path.join(__dirname, "data", file);
      const rawData = fs.readFileSync(filePath, "utf-8");
      const items = JSON.parse(rawData);

      for (const item of items) {
        await pool.query(
          `INSERT INTO parts (name, category, brand, model, price, specs)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.name || "Unknown",
            category,
            item.brand || null,
            item.model || null,
            item.price || null,
            item,
          ]
        );
      }

      console.log(`Imported ${file}`);
    }

    console.log("All data imported successfully");
    await pool.end();
  } catch (err) {
    console.error("Import failed:", err);
    await pool.end();
    process.exit(1);
  }
}

importData();
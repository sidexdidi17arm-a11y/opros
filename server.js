import express from "express";
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = process.env.PORT || 3000;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (Neon connection string)");
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on("error", (e) => console.error("PG pool error:", e));

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

function requireAdmin(req, res, next) {
  const pass = req.header("X-Admin-Password") || "";
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weeks (
      date TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS weeks_timestamp_desc_idx
    ON weeks (timestamp DESC);
  `);
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/data", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT date, timestamp, data FROM weeks ORDER BY timestamp DESC"
    );
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.post("/api/data", requireAdmin, async (req, res) => {
  try {
    const week = req.body;
    if (!week?.date || !Array.isArray(week.data)) {
      return res.status(400).json({ error: "Неверный формат данных" });
    }
    const ts = Number.isFinite(week.timestamp) ? week.timestamp : Date.now();

    await pool.query(
      `
      INSERT INTO weeks(date, timestamp, data)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (date) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        data = EXCLUDED.data,
        updated_at = now()
      `,
      [String(week.date), ts, JSON.stringify(week.data)]
    );

    res.json({ ok: true, saved: week.date });
  } catch (e) {
    res
      .status(500)
      .json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.delete("/api/data", requireAdmin, async (req, res) => {
  try {
    await pool.query("TRUNCATE TABLE weeks");
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.post("/api/data/restore", requireAdmin, async (req, res) => {
  const arr = req.body;
  if (!Array.isArray(arr)) {
    return res.status(400).json({ error: "Ожидается массив данных" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE weeks");

    let inserted = 0;
    for (const w of arr) {
      if (!w?.date || !Array.isArray(w.data)) continue;
      const ts = Number.isFinite(w.timestamp) ? w.timestamp : Date.now();

      await client.query(
        `
        INSERT INTO weeks(date, timestamp, data)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (date) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          data = EXCLUDED.data,
          updated_at = now()
        `,
        [String(w.date), ts, JSON.stringify(w.data)]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
    res.json({ ok: true, total: inserted });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    res
      .status(500)
      .json({ error: "Restore failed", details: String(e?.message || e) });
  } finally {
    client.release();
  }
});

const server = await ensureSchema()
  .then(() =>
    app.listen(PORT, () => console.log("Server listening on", PORT))
  )
  .catch((e) => {
    console.error("Failed to init DB schema:", e);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  try {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  } catch (e) {
    console.error("Shutdown error:", e);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

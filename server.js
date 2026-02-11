import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(express.json({ limit: "2mb" }));

// Render Postgres typically requires SSL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Serve static front-end from /public (index.html, assets, etc.)
app.use(express.static("public"));

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weeks (
      date TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/data", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT date, timestamp, data FROM weeks ORDER BY timestamp DESC"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.post("/api/data", async (req, res) => {
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
      ON CONFLICT (date)
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        data = EXCLUDED.data,
        updated_at = now()
      `,
      [week.date, ts, JSON.stringify(week.data)]
    );

    res.json({ ok: true, saved: week.date });
  } catch (e) {
    res.status(500).json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.delete("/api/data", async (req, res) => {
  try {
    await pool.query("TRUNCATE TABLE weeks");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "DB error", details: String(e?.message || e) });
  }
});

app.post("/api/data/restore", async (req, res) => {
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
        ON CONFLICT (date)
        DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          data = EXCLUDED.data,
          updated_at = now()
        `,
        [w.date, ts, JSON.stringify(w.data)]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
    res.json({ ok: true, total: inserted });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Restore failed", details: String(e?.message || e) });
  } finally {
    client.release();
  }
});

const port = process.env.PORT || 3000;

ensureSchema()
  .then(() => {
    app.listen(port, () => console.log("Server listening on", port));
  })
  .catch((e) => {
    console.error("Failed to init DB schema:", e);
    process.exit(1);
  });

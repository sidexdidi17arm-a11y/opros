// Одноразовый скрипт переноса таблицы `weeks` из старой Render БД в Neon.
// Запуск:
//   1) убедись, что в .env заполнены SOURCE_DATABASE_URL и DATABASE_URL
//   2) npm run migrate
// Если в .env живёт пакет dotenv не нужен — мы используем встроенный --env-file.

import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

// Простейший парсер .env, чтобы не тащить dotenv-зависимость.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.DATABASE_URL;

if (!SOURCE) { console.error("SOURCE_DATABASE_URL is required"); process.exit(1); }
if (!TARGET) { console.error("DATABASE_URL is required");        process.exit(1); }

const src = new Pool({ connectionString: SOURCE, ssl: { rejectUnauthorized: false }, max: 2 });
const dst = new Pool({ connectionString: TARGET, ssl: { rejectUnauthorized: false }, max: 2 });

async function main() {
  console.log("Подключаюсь к источнику…");
  const { rows } = await src.query(
    "SELECT date, timestamp, data FROM weeks ORDER BY timestamp ASC"
  );
  console.log(`Найдено записей: ${rows.length}`);

  console.log("Готовлю целевую схему…");
  await dst.query(`
    CREATE TABLE IF NOT EXISTS weeks (
      date TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await dst.query(`
    CREATE INDEX IF NOT EXISTS weeks_timestamp_desc_idx ON weeks (timestamp DESC);
  `);

  const client = await dst.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `INSERT INTO weeks(date, timestamp, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (date) DO UPDATE SET
           timestamp = EXCLUDED.timestamp,
           data = EXCLUDED.data,
           updated_at = now()`,
        [String(r.date), Number(r.timestamp), JSON.stringify(r.data)]
      );
      inserted += 1;
      if (inserted % 50 === 0) console.log(`  …перенесено ${inserted}/${rows.length}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const { rows: countRows } = await dst.query("SELECT count(*)::int AS n FROM weeks");
  console.log(`✅ Готово. В Neon сейчас ${countRows[0].n} записей (перенесено ${inserted}).`);
}

main()
  .catch((e) => { console.error("❌ Ошибка миграции:", e); process.exit(1); })
  .finally(async () => { await src.end().catch(() => {}); await dst.end().catch(() => {}); });

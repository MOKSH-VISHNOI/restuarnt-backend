require("dotenv").config();
const { Client } = require("pg");
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT
        pid,
        state,
        wait_event_type,
        wait_event,
        NOW() - xact_start AS transaction_age,
        LEFT(query, 180) AS query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
      ORDER BY xact_start;
    `);
    console.table(result.rows);
  } finally {
    await client.end();
  }
}
main().catch(error => {
  console.error("Diagnostic failed:", error.message || error);
  process.exitCode = 1;
});

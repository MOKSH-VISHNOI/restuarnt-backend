require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT
        id,
        gateway,
        "eventType",
        "externalEventId",
        "gatewayPaymentId",
        "gatewayOrderId",
        status,
        "receivedAt",
        "processedAt",
        "processingAttempts",
        "lastError"
      FROM "WebhookEvent"
      WHERE "gatewayOrderId" IN (
        'order_Tr2Zef830EIIgX',
        'order_TrGCbX8ToxNBwE'
      )
      OR "gatewayPaymentId" = 'pay_Tr2aKvCj43dmMv'
      ORDER BY "receivedAt" DESC
    `);
    console.table(result.rows);
  } finally {
    await client.end();
  }
}
main().catch(error => {
  console.error('Diagnostic failed:', error.message);
  process.exitCode = 1;
});

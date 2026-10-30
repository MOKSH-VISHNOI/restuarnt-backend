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
        o.id AS order_id,
        o.status AS order_status,
        o."totalAmount" AS order_amount,
        o."tokenNumber" AS token_number,
        p.id AS payment_id,
        p.status AS payment_status,
        p."gatewayOrderId" AS gateway_order_id,
        p."gatewayPaymentId" AS gateway_payment_id,
        p.gateway,
        p.amount AS payment_amount
      FROM "Order" o
      LEFT JOIN "Payment" p ON p."orderId" = o.id
      WHERE o.id IN (458, 460)
      ORDER BY o.id, p.id
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

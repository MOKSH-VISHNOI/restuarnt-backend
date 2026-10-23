const Razorpay = require("razorpay");

// Lazy initialize Razorpay client so the server can start in dev when env vars are missing.
let razorpay = null;
function getRazorpay() {
  if (razorpay) return razorpay;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    // Leave razorpay as null; functions will throw only when invoked.
    return null;
  }
  razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpay;
}

const createRazorpayOrder = async ({ amount, receipt }) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  const order = await rp.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt,
  });
  return order;
};

// Fetch payments for a Razorpay order (returns array)
const fetchPaymentsForOrder = async (razorpayOrderId) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  // The SDK's payments.all() ignores order_id and returns account-wide payments.
  // Use the order-scoped endpoint so reconciliation only receives this order's payments.
  const resp = await rp.orders.fetchPayments(razorpayOrderId);
  return resp && resp.items ? resp.items : [];
};

// Razorpay order creation cannot be part of a database transaction. If its ID
// could not be persisted, recover it by the stable receipt before retrying.
const findRazorpayOrderByReceipt = async (receipt) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  const response = await rp.orders.all({ receipt, count: 100 });
  return (response?.items || []).find((order) => order.receipt === receipt) || null;
};

// Fetch a single payment by id
const fetchPaymentById = async (paymentId) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing keys)");
  return await rp.payments.fetch(paymentId);
};

// Issue a full or partial refund for a captured payment
const refundPayment = async (paymentId, amount, idempotencyKey) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing keys)");
  const options = {};
  if (amount !== undefined && amount !== null) {
    options.amount = Math.round(Number(amount) * 100);
  }
  if (idempotencyKey) {
    options.notes = { payment_refund_request_key: idempotencyKey };
  }
  return await rp.payments.refund(paymentId, options);
};

const fetchRefundById = async (paymentId, refundId) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing keys)");
  return await rp.payments.fetchRefund(paymentId, refundId);
};

const findRefundByIdempotencyKey = async (paymentId, idempotencyKey) => {
  const rp = getRazorpay();
  if (!rp) throw new Error("Razorpay not configured (missing keys)");
  const response = await rp.payments.fetchMultipleRefund(paymentId, { count: 100 });
  return (response?.items || []).find((refund) =>
    refund.notes?.payment_refund_request_key === idempotencyKey) || null;
};

module.exports = {
  createRazorpayOrder,
  fetchPaymentsForOrder,
  findRazorpayOrderByReceipt,
  fetchPaymentById,
  refundPayment,
  fetchRefundById,
  findRefundByIdempotencyKey,
};

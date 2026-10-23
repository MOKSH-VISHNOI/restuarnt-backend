const express = require("express");
const crypto = require("crypto");
const router = express.Router();

function requireRefundAuthorization(req, res, next) {
  const expected = process.env.PAYMENT_REFUND_API_KEY;
  const supplied = req.get("x-payment-refund-key");
  if (!expected) {
    return res.status(503).json({
      success: false,
      code: "REFUND_AUTH_NOT_CONFIGURED",
      message: "Refund authorization is not configured on this server",
    });
  }
  if (typeof supplied !== "string") {
    return res.status(401).json({ success: false, code: "REFUND_UNAUTHORIZED", message: "Refund authorization is required" });
  }
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
    return res.status(401).json({ success: false, code: "REFUND_UNAUTHORIZED", message: "Refund authorization failed" });
  }
  return next();
}

const {
  createPaymentOrder,
  verifyRazorpayPayment,
  reconcileCheckoutFailure,
  refundRazorpayPayment,
  reconcileRazorpayRefund,
  getPaymentAttemptsForOrder,
} = require("../controllers/paymentController");

// Create a Razorpay payment order
router.post("/razorpay/order", createPaymentOrder);

// Verify a Razorpay payment
router.post("/razorpay/verify", verifyRazorpayPayment);

// Reconcile the exact payment returned by Razorpay Checkout's failed callback.
router.post("/razorpay/reconcile-failure", reconcileCheckoutFailure);

// Refund a captured payment (full or partial)
router.post("/razorpay/refund", requireRefundAuthorization, refundRazorpayPayment);
router.post("/razorpay/refund/reconcile", requireRefundAuthorization, reconcileRazorpayRefund);

// Query payment attempts for an order (durable recovery/reconciliation)
router.get("/order/:orderId/attempts", getPaymentAttemptsForOrder);

// Test-only helper endpoints (enabled only when PRISMA_MOCK=1)
if (process.env.PRISMA_MOCK === '1') {
  const prisma = require('../config/prisma');

  // Create a mock payment for an order
  router.post('/__test__/create-payment', async (req, res) => {
    try {
      const { orderId, idempotencyKey, gatewayOrderId } = req.body;
      const p = await prisma.payment.create({ data: { orderId: Number(orderId), amount: 100, status: 'PENDING', gateway: 'RAZORPAY', idempotencyKey, gatewayOrderId } });
      return res.json({ success: true, payment: p });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  });

  // Update a mock payment by id
  router.post('/__test__/update-payment', async (req, res) => {
    try {
      const { id, data } = req.body;
      const p = await prisma.payment.update({ where: { id: Number(id) }, data });
      return res.json({ success: true, payment: p });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  });

  // Expose in-memory state for testing
  router.get('/__test__/state', async (req, res) => {
    try {
      const orders = await prisma.order.findUnique({ where: { id: 1 }, include: { payments: true } });
      // For the mock, also return payments and webhookEvents arrays directly if available
      let extra = {};
      if (prisma._rawState) extra._rawState = prisma._rawState;
      return res.json({ success: true, orders, extra });
    } catch (err) {
      return res.status(500).json({ success: false, error: String(err) });
    }
  });
}



module.exports = router;

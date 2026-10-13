const express = require("express");
const router = express.Router();

const {
  createPaymentOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} = require("../controllers/paymentController");

// Create a Razorpay payment order
router.post("/razorpay/order", createPaymentOrder);

// Verify a Razorpay payment
router.post("/razorpay/verify", verifyRazorpayPayment);

// Handle Razorpay webhooks
router.post("/webhook", handleRazorpayWebhook);

module.exports = router;
const express = require("express");
const router = express.Router();

const {
  handleRazorpayWebhook,
} = require("../controllers/paymentController");

// IMPORTANT: this route must receive the raw request body so the
// Razorpay webhook signature can be verified correctly.
router.post(
  "/",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook
);

module.exports = router;

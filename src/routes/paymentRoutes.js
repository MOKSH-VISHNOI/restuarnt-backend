const express = require("express");
const router = express.Router();

const {
  createPaymentOrder,
  verifyRazorpayPayment,
} = require("../controllers/paymentController");

// Create a Razorpay payment order for an existing Yatharth order
router.post("/razorpay/order", createPaymentOrder);
router.post("/razorpay/verify", verifyRazorpayPayment);
module.exports = router;
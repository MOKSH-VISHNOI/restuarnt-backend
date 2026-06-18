const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getOrderById,
  getOrderByToken,
  updateOrderStatus
} = require("../controllers/orderController");

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.get("/token/:tokenNumber", getOrderByToken);
router.put("/:id/status", updateOrderStatus);

module.exports = router;
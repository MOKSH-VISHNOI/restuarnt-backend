const express = require("express");

const router = express.Router();

const {
  getKitchenOrders,
  startPreparing,
  markReady,
  moveBackToPlaced
} = require("../controllers/kitchenController");


// Get all active kitchen orders
router.get(
  "/orders",
  getKitchenOrders
);


// PLACED → PREPARING
router.patch(
  "/orders/:id/start",
  startPreparing
);


// PREPARING → READY
router.patch(
  "/orders/:id/ready",
  markReady
);

// MOVEBACK
router.patch(
  "/orders/:id/revert",
  moveBackToPlaced
);

module.exports = router;
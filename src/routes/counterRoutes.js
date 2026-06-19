const express = require("express");

const router = express.Router();

const {

    getCounterOrders,
    collectOrder

} = require(
    "../controllers/counterController"
);


// READY ORDERS

router.get(
    "/orders",
    getCounterOrders
);


// READY → COLLECTED

router.patch(
    "/orders/:id/collect",
    collectOrder
);

module.exports = router;
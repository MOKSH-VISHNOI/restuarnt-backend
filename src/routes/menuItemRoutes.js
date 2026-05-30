const express = require("express");

const router = express.Router();

const {
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem
} = require("../controllers/menuItemController");

router.post("/", createMenuItem);

router.get("/", getMenuItems);

router.put("/:id", updateMenuItem);

router.delete("/:id", deleteMenuItem);

module.exports = router;
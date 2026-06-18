const express = require("express");

const router = express.Router();

const {
  getDisplayData
} = require("../controllers/displayController");

router.get("/", getDisplayData);

module.exports = router;
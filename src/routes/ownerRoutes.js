const express = require("express");
const router = express.Router();
const { getOverviewData } = require("../controllers/ownerController");

// Overview dashboard endpoint
router.get("/overview", getOverviewData);

module.exports = router;

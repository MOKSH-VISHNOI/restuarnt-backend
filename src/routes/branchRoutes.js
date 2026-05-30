const express = require("express");

const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} = require("../controllers/branchController");

const router = express.Router();

router.get("/", getBranches);

router.post("/", createBranch);

router.put("/:id", updateBranch);

router.delete("/:id", deleteBranch);

module.exports = router;
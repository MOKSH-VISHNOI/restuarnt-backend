const express =
    require("express");

const router =
    express.Router();

const {
    createFeedback
} = require(
    "../controllers/feedbackController"
);


// ==========================================
// CREATE FEEDBACK
// ==========================================

router.post(
    "/",
    createFeedback
);


module.exports =
    router;
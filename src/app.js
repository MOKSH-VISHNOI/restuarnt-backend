const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const paymentRoutes = require("./routes/paymentRoutes");
const paymentWebhookRoutes = require("./routes/paymentWebhookRoutes");

app.use(cors());
app.use(
  "/api/payments/webhook",
  paymentWebhookRoutes
);

app.use(express.json());

app.use(
  "/api/payments",
  paymentRoutes
);


app.use(
  express.static(
    path.join(__dirname, "../frontend")
  )
);

/* ROUTES */

const orderRoutes = require("./routes/orderRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const displayRoutes = require("./routes/displayRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const branchRoutes = require("./routes/branchRoutes");
const counterRoutes = require("./routes/counterRoutes");
const menuItemRoutes = require("./routes/menuItemRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const ownerRoutes = require("./routes/ownerRoutes");


app.use("/customer", express.static(path.join(__dirname, "../customer")));
app.use("/owner", express.static(path.join(__dirname, "../frontend/owner")));

app.use("/orders", orderRoutes);
app.use("/kitchen", kitchenRoutes);
app.use("/display", displayRoutes);
app.use("/categories", categoryRoutes);
app.use("/branches", branchRoutes);
app.use("/counter", counterRoutes);
app.use("/menu-items", menuItemRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/owner/api", ownerRoutes);

module.exports = app;
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

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

app.use("/orders", orderRoutes);
app.use("/kitchen", kitchenRoutes);
app.use("/display", displayRoutes);
app.use("/categories", categoryRoutes);
app.use("/branches", branchRoutes);

module.exports = app;
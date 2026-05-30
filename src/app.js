const express = require("express");

const branchRoutes = require("./routes/branchRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const menuItemRoutes = require("./routes/menuItemRoutes");

const app = express();

app.use(express.json());

app.use("/branches", branchRoutes);

app.use("/categories", categoryRoutes);

app.use("/menu-items", menuItemRoutes);

module.exports = app;
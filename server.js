const express = require("express");
require("dotenv").config();

const prisma = require("./lib/prisma");

const app = express();

app.get("/", async (req, res) => {

    const branches = await prisma.branch.findMany();

    res.json(branches);

});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
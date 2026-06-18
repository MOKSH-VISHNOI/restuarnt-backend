const prisma = require("../config/prisma");

const getDisplayData = async (req, res) => {
  try {

    const preparing = await prisma.order.findMany({
      where: {
        status: "PREPARING"
      },
      select: {
        tokenNumber: true
      },
      orderBy: {
        tokenNumber: "asc"
      }
    });

    const ready = await prisma.order.findMany({
      where: {
        status: "READY"
      },
      select: {
        tokenNumber: true
      },
      orderBy: {
        tokenNumber: "asc"
      }
    });

    res.json({
      preparingCount: preparing.length,
      readyCount: ready.length,
      preparing,
      ready
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Failed to fetch display data"
    });

  }
};

module.exports = {
  getDisplayData
};
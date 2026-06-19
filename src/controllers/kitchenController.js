const prisma = require("../config/prisma");

// Get all active kitchen orders
const getKitchenOrders = async (req, res) => {
  try {

    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ["PLACED", "PREPARING"]
        }
      },

      select: {
        id: true,
        tokenNumber: true,
        status: true,
        createdAt: true,

        items: {
          select: {
            quantity: true,

            menuItem: {
              select: {
                name: true,
                price: true
              }
            }
          }
        }
      },

      orderBy: {
        createdAt: "asc"
      }
    });

    res.json(orders);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }
};


// PLACED → PREPARING
const startPreparing = async (req, res) => {
  try {

    const order = await prisma.order.update({
      where: {
          id: Number(req.params.id)
      },
      data: {
          status: "PREPARING",
          startedAt: new Date()
      },
      select: {
          id: true,
          tokenNumber: true,
          status: true
      }
  });

    const io = req.app.get("io");

    io.emit("ORDER_STATUS_UPDATED", order);
    io.emit("DISPLAY_REFRESH");

    res.json(order);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }
};


// PREPARING → READY
const markReady = async (req, res) => {
  try {

    const order = await prisma.order.update({
      where: {
          id: Number(req.params.id)
      },
      data: {
          status: "READY",
          readyAt: new Date()
      },
      select: {
          id: true,
          tokenNumber: true,
          status: true
      }
  });

    const io = req.app.get("io");

io.emit("ORDER_READY", order);
io.emit("ORDER_STATUS_UPDATED", order);
io.emit("DISPLAY_REFRESH");

    res.json(order);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }
};

const moveBackToPlaced = async (req, res) => {

  try {

    const order = await prisma.order.update({
      where: {
        id: Number(req.params.id)
      },

      data: {
        status: "PLACED"
      },

      select: {
        id: true,
        tokenNumber: true,
        status: true
      }
    });

    const io = req.app.get("io");

    io.emit("ORDER_STATUS_UPDATED", order);
    io.emit("DISPLAY_REFRESH");

    res.json(order);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

};

module.exports = {
  getKitchenOrders,
  startPreparing,
  markReady,
  moveBackToPlaced,
};
const prisma = require("../config/prisma");

const createOrder = async (req, res) => {
  try {
    const { branchId, items } = req.body;

    let totalAmount = 0;

    // Fetch menu items from database
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: {
          in: items.map(item => item.menuItemId)
        }
      }
    });

    // Water Only decision
    const isWaterOnly = menuItems.every(
      item =>
        item.name
          .toLowerCase()
          .includes("water")
    );

    // Calculate total
    items.forEach(item => {
      const menuItem = menuItems.find(
        m => m.id === item.menuItemId
      );

      if (menuItem) {
        totalAmount += menuItem.price * item.quantity;
      }
    });

    // Generate daily token number

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );
    
    const lastOrder =
      await prisma.order.findFirst({
    
        where: {
          createdAt: {
            gte: today
          }
        },
    
        orderBy: {
          tokenNumber: "desc"
        }
    
      });
    
    const tokenNumber =
      lastOrder
        ? lastOrder.tokenNumber + 1
        : 101;

    // Create order
    const order = await prisma.order.create({
      data: {
        branchId,
        tokenNumber,
        totalAmount,
    
        status: isWaterOnly
          ? "READY"
          : "PLACED",
    
        readyAt: isWaterOnly
          ? new Date()
          : null,
    
        items: {
          create: items.map(item => ({
            quantity: item.quantity,
            menuItemId: item.menuItemId
          }))
        }
      },
    
      include: {
        items: true
      }
    });

    const io = req.app.get("io");

    if (isWaterOnly) {

      io.emit(
        "ORDER_READY",
        order
      );
    
      io.emit(
        "DISPLAY_REFRESH"
      );
    
    } else {
    
      io.emit(
        "NEW_ORDER",
        order
      );
    
    }

    res.status(201).json(order);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create order"
    });
  }
};


const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: true
      }
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch orders"
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: Number(req.params.id),
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch order",
    });
  }
};

const getOrderByToken = async (req, res) => {
  try {
    const tokenNumber = Number(req.params.tokenNumber);

    const order = await prisma.order.findUnique({
      where: {
        tokenNumber,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    res.status(200).json(order);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch order",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    const validTransitions = {
      PLACED: ["PREPARING"],
      PREPARING: ["READY"],
      READY: ["COLLECTED"],
      COLLECTED: []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        error: `Cannot move from ${order.status} to ${status}`
      });
    }

    const updateData = {
      status
    };

    if (status === "PREPARING") {
      updateData.startedAt = new Date();
    }

    if (status === "READY") {
      updateData.readyAt = new Date();
    }

    if (status === "COLLECTED") {
      updateData.collectedAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId
      },
      data: updateData
    });

    const io = req.app.get("io");

    console.log("EMITTING SOCKET EVENT");
    
  io.emit("order-status-updated", {
    orderId: updatedOrder.id,
    tokenNumber: updatedOrder.tokenNumber,
    status: updatedOrder.status
  });

    res.json(updatedOrder);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update order status"
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getOrderByToken,
  updateOrderStatus
};
const prisma = require("../config/prisma");
const { getPaymentSummary } = require("../utils/paymentSummary");

const createOrder = async (req, res) => {
  try {
    const body = req.body || {};
    const { branchId, items, idempotencyKey } = body;
    // QR orders always require online payment. Payment requirements are a
    // server-side policy and cannot be disabled by a client request.
    if (body.paymentRequired !== undefined && body.paymentRequired !== true) {
      return res.status(400).json({
        success: false,
        code: "PAYMENT_REQUIRED",
        message: "QR orders must be paid before they are released",
      });
    }
    const paymentRequired = true;
    if (!Number.isSafeInteger(Number(branchId)) || Number(branchId) <= 0 ||
      !Array.isArray(items) || items.length === 0 ||
      typeof idempotencyKey !== "string" || idempotencyKey.trim() !== idempotencyKey ||
      idempotencyKey.length < 10 || idempotencyKey.length > 200) {
      return res.status(400).json({ success: false, code: "INVALID_ORDER_REQUEST", message: "A valid branch, items, and idempotencyKey are required" });
    }

    const normalizedItems = items.map((item) => ({
      menuItemId: Number(item?.menuItemId),
      quantity: Number(item?.quantity),
    }));
    if (normalizedItems.some((item) => !Number.isSafeInteger(item.menuItemId) || item.menuItemId <= 0 ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
      return res.status(400).json({ success: false, code: "INVALID_ORDER_ITEMS", message: "Every item must have a valid menu item and positive integer quantity" });
    }
    normalizedItems.sort((a, b) => a.menuItemId - b.menuItemId);

    const sameRequest = (order) => {
      if (order.branchId !== Number(branchId) || order.orderSource !== "QR" ||
        order.paymentRequired !== paymentRequired ||
        order.items.length !== normalizedItems.length) return false;
      const savedItems = order.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
        .sort((a, b) => a.menuItemId - b.menuItemId);
      return savedItems.every((item, index) => item.menuItemId === normalizedItems[index].menuItemId &&
        item.quantity === normalizedItems[index].quantity);
    };
    const include = { items: { include: { menuItem: true } } };
    let created = false;

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        const prior = await tx.order.findUnique({ where: { idempotencyKey }, include });
        if (prior) {
          if (!sameRequest(prior)) {
            const error = new Error("Idempotency key reused for a different order");
            error.code = "ORDER_IDEMPOTENCY_CONFLICT";
            throw error;
          }
          return prior;
        }

        const menuItems = await tx.menuItem.findMany({
          where: { id: { in: normalizedItems.map((item) => item.menuItemId) } },
        });
        if (menuItems.length !== new Set(normalizedItems.map((item) => item.menuItemId)).size ||
          menuItems.some((item) => !item.available)) {
          const error = new Error("One or more menu items are unavailable");
          error.code = "ORDER_ITEMS_UNAVAILABLE";
          throw error;
        }

        const totalAmount = Math.round(normalizedItems.reduce((sum, item) => {
          const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
          return sum + menuItem.price * item.quantity;
        }, 0) * 100) / 100;
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          const error = new Error("Order amount is invalid");
          error.code = "INVALID_ORDER_AMOUNT";
          throw error;
        }
        const isWaterOnly = normalizedItems.every((item) =>
          menuItems.find((menuItem) => menuItem.id === item.menuItemId).name.toLowerCase().includes("water"));
        let tokenNumber = null;
        const timestamp = new Date();
        if (!paymentRequired) {
          const today = new Date(timestamp);
          today.setHours(0, 0, 0, 0);
          await tx.dailyTokenCounter.upsert({
            where: { counterDate: today },
            create: { counterDate: today, lastToken: 100 },
            update: {},
          });
          const counter = await tx.dailyTokenCounter.update({
            where: { counterDate: today },
            data: { lastToken: { increment: 1 } },
          });
          tokenNumber = counter.lastToken;
        }
        const result = await tx.order.create({
          data: {
            branchId: Number(branchId),
            idempotencyKey,
            paymentRequired,
            tokenNumber,
            totalAmount,
            status: paymentRequired ? "PENDING_PAYMENT" : isWaterOnly ? "READY" : "PLACED",
            placedAt: paymentRequired ? null : timestamp,
            readyAt: paymentRequired ? null : isWaterOnly ? timestamp : null,
            items: { create: normalizedItems },
          },
          include,
        });
        created = true;
        return result;
      });
    } catch (error) {
      if (error.code === "ORDER_IDEMPOTENCY_CONFLICT") {
        return res.status(409).json({ success: false, code: error.code, message: error.message });
      }
      if (error.code === "ORDER_ITEMS_UNAVAILABLE" || error.code === "INVALID_ORDER_AMOUNT") {
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      }
      // Two requests can race on the unique key. Return the winner's order when
      // both requests describe the same cart; never create a second token/order.
      if (error.code === "P2002") {
        const prior = await prisma.order.findUnique({ where: { idempotencyKey }, include });
        if (prior && sameRequest(prior)) return res.status(200).json(prior);
        return res.status(409).json({ success: false, code: "ORDER_IDEMPOTENCY_CONFLICT", message: "This idempotency key is already in use" });
      }
      throw error;
    }

    if (created && !paymentRequired) {
      const io = req.app.get("io");
      if (io?.emit) {
        if (order.status === "READY") {
          io.emit("ORDER_READY", order);
          io.emit("DISPLAY_REFRESH");
        } else {
          io.emit("NEW_ORDER", order);
        }
      }
    }
    return res.status(created ? 201 : 200).json(order);
  } catch (error) {
    console.error("Order creation failed:", error);
    return res.status(500).json({ success: false, error: "Failed to create order" });
  }

};


const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include:{

        items:{
    
            include:{
    
                menuItem:true
    
            }
    
        }
    
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
      include:{

        items:{
    
            include:{
    
                menuItem:true
    
            }
    
        },
    
        feedback:true,
        payments: {
          where: { gateway: "RAZORPAY" },
          select: {
            gateway: true,
            status: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
            transactions: { select: { gatewayPaymentId: true, status: true } },
          },
        }
    
    },
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const { payments, ...publicOrder } = order;
    res.json({ ...publicOrder, ...getPaymentSummary({ ...order, payments }) });
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
    if (!Number.isSafeInteger(tokenNumber) || tokenNumber <= 0) {
      return res.status(400).json({ error: "A valid token number is required" });
    }

    // Tokens are reused on different days, so resolve the token within a
    // specific counter day rather than querying a non-unique field as unique.
    const requestedDate = req.query?.date;
    let dayStart = new Date();
    if (requestedDate !== undefined) {
      if (typeof requestedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return res.status(400).json({ error: "date must use YYYY-MM-DD format" });
      }
      const [year, month, day] = requestedDate.split("-").map(Number);
      dayStart = new Date(year, month - 1, day);
      if (dayStart.getFullYear() !== year || dayStart.getMonth() !== month - 1 || dayStart.getDate() !== day) {
        return res.status(400).json({ error: "date is invalid" });
      }
    }
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const order = await prisma.order.findFirst({
      where: {
        tokenNumber,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { createdAt: "desc" },
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

    if (!(validTransitions[order.status] || []).includes(status)) {
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
  updateOrderStatus,
};

const prisma = require("../lib/prisma");
const crypto = require("crypto");
const {
  createRazorpayOrder,
} = require("../services/razorpayService");

const createPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      });
    }

    // 1. Find the Yatharth order
    const order = await prisma.order.findUnique({
      where: {
        id: Number(orderId),
      },
      include: {
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 2. Check if this order is already successfully paid
    const successfulPayment = order.payments.find(
      (payment) => payment.status === "SUCCESS"
    );

    if (successfulPayment) {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
        payment: successfulPayment,
      });
    }

    // 3. Reuse an existing pending Razorpay payment if available
    const pendingPayment = order.payments.find(
      (payment) =>
        payment.status === "PENDING" &&
        payment.gateway === "RAZORPAY" &&
        payment.gatewayOrderId
    );

    if (pendingPayment) {
      return res.status(200).json({
        success: true,
        message: "Existing Razorpay payment order returned",
    
        order: {
          id: order.id,
          amount: order.totalAmount,
          currency: "INR",
        },
    
        payment: pendingPayment,
    
        razorpayOrder: {
          id: pendingPayment.gatewayOrderId,
          amount: Math.round(pendingPayment.amount * 100),
          currency: "INR",
        },
      });
    }

    // 4. Create Razorpay order using the actual Yatharth order amount
    const razorpayOrder = await createRazorpayOrder({
      amount: order.totalAmount,
      receipt: `ORDER_${order.id}_${Date.now()}`,
    });

    // 5. Save payment information in Yatharth
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalAmount,
        status: "PENDING",
        gateway: "RAZORPAY",
        gatewayOrderId: razorpayOrder.id,
      },
    });

    // 6. Return both Yatharth + Razorpay information
    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",

      order: {
        id: order.id,
        amount: order.totalAmount,
        currency: "INR",
      },

      payment,

      razorpayOrder,
    });
  } catch (error) {
    console.error("Create payment order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};


const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    if (
      !orderId ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "All payment verification fields are required",
      });
    }

    // 1. Find the Yatharth order
    const order = await prisma.order.findUnique({
      where: {
        id: Number(orderId),
      },
      include: {
        payments: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 2. Find the matching pending Razorpay payment
    const payment = order.payments.find(
      (item) =>
        item.gateway === "RAZORPAY" &&
        item.status === "PENDING" &&
        item.gatewayOrderId === razorpay_order_id
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Matching pending Razorpay payment not found",
      });
    }

    // 3. Generate expected Razorpay signature
    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${payment.gatewayOrderId}|${razorpay_payment_id}`
      )
      .digest("hex");

    // 4. Verify signature
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // 5. Check whether this is a water-only order
    const isWaterOnly =
      order.items.length > 0 &&
      order.items.every(
        (item) =>
          item.menuItem?.name
            ?.toLowerCase()
            .includes("water")
      );

    // 6. Update payment + release order
    const updatedPayment =
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "SUCCESS",
          gatewayPaymentId:
            razorpay_payment_id,
        },
      });

    const updatedOrder =
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: isWaterOnly
            ? "READY"
            : "PLACED",

          placedAt: new Date(),

          readyAt: isWaterOnly
            ? new Date()
            : null,
        },
      });

    // 7. Notify the restaurant
    const io = req.app.get("io");

    if (isWaterOnly) {
      io.emit("ORDER_READY", updatedOrder);
      io.emit("DISPLAY_REFRESH");
    } else {
      io.emit("NEW_ORDER", updatedOrder);
    }

    // 8. Response
    return res.status(200).json({
      success: true,
      message:
        "Payment verified and order released successfully",

      payment: updatedPayment,

      order: updatedOrder,
    });

  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

// Temporary webhook handler.
// We will implement signature verification and payment processing later.
const handleRazorpayWebhook = async (req, res) => {
  try {
    console.log("Razorpay webhook received");

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};


module.exports = {
  createPaymentOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
};
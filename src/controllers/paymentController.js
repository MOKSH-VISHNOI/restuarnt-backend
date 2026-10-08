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

    // 2. Find the matching Razorpay payment
    const payment = order.payments.find(
      (item) =>
        item.gateway === "RAZORPAY" &&
        item.gatewayOrderId === razorpay_order_id
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Matching Razorpay payment not found",
      });
    }


    // 2.5 Payment may already have been processed by the webhook
    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
        payment,
        order,
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

    // 6. Update payment + generate token + release order
    const result = await prisma.$transaction(async (tx) => {

      // Mark payment as successful
      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: {
          status: "SUCCESS",
          gatewayPaymentId: razorpay_payment_id,
        },
      });
      
      if (paymentClaim.count === 0) {
        return {
          alreadyProcessed: true,
        };
      }
      
      const updatedPayment = await tx.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

  // Generate token only after successful payment
  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  let counter =
    await tx.dailyTokenCounter.findUnique({
      where: {
        counterDate: today,
      },
    });

  if (!counter) {
    counter =
      await tx.dailyTokenCounter.create({
        data: {
          counterDate: today,
          lastToken: 100,
        },
      });
  }

  counter =
    await tx.dailyTokenCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        lastToken: {
          increment: 1,
        },
      },
    });

  const tokenNumber =
    counter.lastToken;

  // Release order into restaurant workflow
  const updatedOrder = await tx.order.update({
    where: {
      id: order.id,
    },
    data: {
      tokenNumber,
  
      status: isWaterOnly
        ? "READY"
        : "PLACED",
  
      placedAt: new Date(),
  
      readyAt: isWaterOnly
        ? new Date()
        : null,
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
    },
  });

  return {
    updatedPayment,
    updatedOrder,
  };
});

    if (result.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    const {
      updatedPayment,
      updatedOrder,
    } = result;

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

    // 1. Verify Razorpay webhook signature
    const webhookSignature = req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Webhook signature missing",
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // 2. Parse the raw webhook body
    const payload = JSON.parse(req.body.toString("utf8"));

    const webhookEventId = payload.id;
    const event = payload.event;

    console.log("Razorpay webhook event:", event);
    console.log("Razorpay webhook event ID:", webhookEventId);

    // 3. We are handling payment.captured for now
    if (event !== "payment.captured") {
      return res.status(200).json({
        success: true,
        message: "Event received but not handled",
      });
    }

    // 4. Extract Razorpay payment information
    const paymentEntity =
      payload.payload?.payment?.entity;

    if (!paymentEntity) {
      return res.status(400).json({
        success: false,
        message: "Payment entity missing",
      });
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    if (!razorpayPaymentId || !razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment/order ID missing",
      });
    }

    // Check whether this webhook event was already processed
    if (webhookEventId) {
      const existingWebhook = await prisma.payment.findUnique({
        where: {
          webhookEventId,
        },
      });

      if (existingWebhook) {
        console.log(
          "Duplicate Razorpay webhook ignored:",
          webhookEventId
        );

        return res.status(200).json({
          success: true,
          message: "Webhook already processed",
        });
      }
    }

    // 5. Find the Yatharth payment
    const payment = await prisma.payment.findFirst({
      where: {
        gateway: "RAZORPAY",
        gatewayOrderId: razorpayOrderId,
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      console.error(
        "Yatharth payment not found for Razorpay order:",
        razorpayOrderId
      );

      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // 6. Idempotency check
    if (payment.status === "SUCCESS") {
      console.log(
        "Payment already processed:",
        payment.id
      );

      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // 7. Check whether this is a water-only order
    const isWaterOnly =
      payment.order.items.length > 0 &&
      payment.order.items.every(
        (item) =>
          item.menuItem?.name
            ?.toLowerCase()
            .includes("water")
      );

    // 8. Update payment + generate token + release order
    const result = await prisma.$transaction(async (tx) => {

      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: {
          status: "SUCCESS",
          gatewayPaymentId: razorpayPaymentId,
          webhookEventId,
        },
      });
      
      if (paymentClaim.count === 0) {
        return {
          alreadyProcessed: true,
        };
      }
      
      const updatedPayment = await tx.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      // Generate token
      const today = new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      let counter =
        await tx.dailyTokenCounter.findUnique({
          where: {
            counterDate: today,
          },
        });

      if (!counter) {
        counter =
          await tx.dailyTokenCounter.create({
            data: {
              counterDate: today,
              lastToken: 100,
            },
          });
      }

      counter =
        await tx.dailyTokenCounter.update({
          where: {
            id: counter.id,
          },
          data: {
            lastToken: {
              increment: 1,
            },
          },
        });

      const tokenNumber =
        counter.lastToken;

      // Release order
      const updatedOrder =
        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            tokenNumber,

            status: isWaterOnly
              ? "READY"
              : "PLACED",

            placedAt: new Date(),

            readyAt: isWaterOnly
              ? new Date()
              : null,
          },
        });

      return {
        updatedPayment,
        updatedOrder,
      };
    });

    if (result.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // 9. Notify restaurant
    const io = req.app.get("io");

    if (isWaterOnly) {
      io.emit(
        "ORDER_READY",
        result.updatedOrder
      );

      io.emit("DISPLAY_REFRESH");
    } else {
      io.emit(
        "NEW_ORDER",
        result.updatedOrder
      );
    }

    console.log(
      "Payment captured and order released:",
      result.updatedOrder.id
    );

    // 10. Acknowledge Razorpay
    return res.status(200).json({
      success: true,
      message:
        "Payment webhook processed successfully",
    });

  } catch (error) {
    console.error(
      "Webhook processing error:",
      error
    );

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
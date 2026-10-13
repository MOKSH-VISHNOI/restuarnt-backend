const prisma = require("../lib/prisma");
const crypto = require("crypto");
const {
  createRazorpayOrder,
} = require("../services/razorpayService");

const createPaymentOrder = async (req, res) => {
  try {
      const { orderId, idempotencyKey } = req.body;

      if (!orderId || !idempotencyKey) {
          return res.status(400).json({
              success: false,
              message: "orderId and idempotencyKey are required",
          });
      }

      if (
          typeof idempotencyKey !== "string" ||
          idempotencyKey.length < 10 ||
          idempotencyKey.length > 200
      ) {
          return res.status(400).json({
              success: false,
              message: "Invalid idempotencyKey",
          });
      }

      const numericOrderId = Number(orderId);

      if (!Number.isSafeInteger(numericOrderId) || numericOrderId <= 0) {
          return res.status(400).json({
              success: false,
              message: "Invalid orderId",
          });
      }

      // 1. Find the restaurant order.
      const order = await prisma.order.findUnique({
          where: {
              id: numericOrderId,
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

      if (order.status !== "PENDING_PAYMENT") {
          return res.status(400).json({
              success: false,
              message: "This order is not awaiting payment",
          });
      }

      // 2. Never create a payment attempt for an already-paid order.
      const successfulPayment = order.payments.find(
          (payment) =>
              payment.gateway === "RAZORPAY" &&
              payment.status === "SUCCESS"
      );

      if (successfulPayment) {
          return res.status(409).json({
              success: false,
              message: "This order has already been paid",
          });
      }

      // 3. Check whether this exact request was already recorded.
      const existingAttempt = await prisma.payment.findUnique({
          where: {
              idempotencyKey,
          },
      });

      if (existingAttempt) {
          if (
              existingAttempt.orderId !== numericOrderId ||
              existingAttempt.gateway !== "RAZORPAY"
          ) {
              return res.status(409).json({
                  success: false,
                  message: "This idempotency key is already in use",
              });
          }

          // A previously recorded attempt must have a Razorpay order
          // before it can be returned to Checkout.
          if (!existingAttempt.gatewayOrderId) {
              return res.status(409).json({
                  success: false,
                  message:
                      "This payment attempt is still being prepared. Please try again shortly.",
              });
          }

          return res.status(200).json({
              success: true,
              message: "Existing payment attempt returned",
              order: {
                  id: order.id,
                  amount: order.totalAmount,
                  currency: "INR",
              },
              payment: existingAttempt,
              razorpayOrder: {
                  id: existingAttempt.gatewayOrderId,
                  amount: Math.round(existingAttempt.amount * 100),
                  currency: "INR",
              },
          });
      }

      // 4. Enforce the maximum number of Razorpay attempts.
      const paymentAttempts = order.payments.filter(
          (payment) => payment.gateway === "RAZORPAY"
      );

      const MAX_PAYMENT_ATTEMPTS = 3;

      if (paymentAttempts.length >= MAX_PAYMENT_ATTEMPTS) {
          return res.status(429).json({
              success: false,
              message:
                  "Maximum payment attempts reached for this order. Please contact the restaurant.",
          });
      }

      // 5. Do not create a second attempt while an earlier one is pending.
      const pendingAttempt = paymentAttempts.find(
          (payment) =>
              payment.status === "PENDING" &&
              payment.gatewayOrderId
      );

      if (pendingAttempt) {
          return res.status(409).json({
              success: false,
              code: "PAYMENT_ATTEMPT_PENDING",
              message:
                  "A payment attempt is already pending. Resume that attempt instead of creating another one.",
              paymentId: pendingAttempt.id,
          });
      }

      // 6. Reserve this idempotency key in the database before
      // contacting Razorpay.
      const payment = await prisma.payment.create({
          data: {
              orderId: order.id,
              amount: order.totalAmount,
              status: "PENDING",
              gateway: "RAZORPAY",
              idempotencyKey,
          },
      });

      // 7. Create the Razorpay order.
      let razorpayOrder;

      try {
          razorpayOrder = await createRazorpayOrder({
              amount: order.totalAmount,
              receipt: `ORDER_${order.id}_PAYMENT_${payment.id}`,
          });
      } catch (error) {
          // Keep the reservation so a retry with the same key cannot
          // accidentally create another Razorpay order.
          console.error(
              "Razorpay order creation failed for payment:",
              payment.id,
              error
          );

          return res.status(502).json({
              success: false,
              message:
                  "We could not confirm payment setup. Please retry shortly using the same payment attempt.",
          });
      }

      // 8. Attach the Razorpay order ID to the reserved attempt.
      const updatedPayment = await prisma.payment.update({
          where: {
              id: payment.id,
          },
          data: {
              gatewayOrderId: razorpayOrder.id,
          },
      });

      // 9. Return the payment information.
      return res.status(201).json({
          success: true,
          message: "Payment order created successfully",
          order: {
              id: order.id,
              amount: order.totalAmount,
              currency: "INR",
          },
          payment: updatedPayment,
          razorpayOrder,
      });
  } catch (error) {
      console.error("Create payment order error:", error);

      // Prisma P2002 means a unique constraint was violated.
      // This may happen if the same key was submitted concurrently.
      if (error.code === "P2002") {
          return res.status(409).json({
              success: false,
              message:
                  "This payment request is already being processed. Please retry shortly.",
          });
      }

      return res.status(500).json({
          success: false,
          message: "Failed to create payment order",
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

  // Atomically create today's counter if it doesn't exist.
  await tx.dailyTokenCounter.upsert({
    where: {
      counterDate: today,
    },
    create: {
      counterDate: today,
      lastToken: 100,
    },
    update: {},
  });

  // Increment the counter atomically.
  const counter = await tx.dailyTokenCounter.update({
    where: {
      counterDate: today,
    },
    data: {
      lastToken: {
        increment: 1,
      },
    },
  });

  const tokenNumber = counter.lastToken;

  // Release order into restaurant workflow
  const updatedOrder = await tx.order.update({
    where: {
      id: payment.order.id,
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
      const latestOrder = await prisma.order.findUnique({
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

      return res.status(200).json({
        success: true,
        message: "Payment already processed",
        payment: latestOrder?.payments.find(
          (item) => item.id === payment.id
        ),
        order: latestOrder,
      });
    }

    const {
      updatedPayment,
      updatedOrder,
    } = result;

  // . Notify the restaurant
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
  console.log("========== RAZORPAY WEBHOOK RECEIVED ==========");

  let webhookRecord = null;

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

    const event = payload.event;

    // Razorpay's current payload does not include a top-level event ID.
    // Use the payment record's status and atomic database updates
    // to prevent duplicate processing.

    console.log("Razorpay webhook event:", event);

    // 3. Handle supported payment events
    if (
      event !== "payment.captured" &&
      event !== "payment.failed"
    ) {
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

    // Record the incoming Razorpay event
    const eventKey =
    payload.id ?? `${event}:${razorpayPaymentId}`;

    try {
    webhookRecord = await prisma.webhookEvent.create({
      data: {
        gateway: "RAZORPAY",
        eventType: event,
        externalEventId: eventKey,
        gatewayPaymentId: razorpayPaymentId,
        gatewayOrderId: razorpayOrderId,
        status: "RECEIVED",
      },
    });
    } catch (error) {
    // Handle duplicate webhook events
    if (error.code !== "P2002") {
      throw error;
    }

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        gateway_externalEventId: {
          gateway: "RAZORPAY",
          externalEventId: eventKey,
        },
      },
    });

    if (
      existingEvent &&
      existingEvent.status === "PROCESSED"
    ) {
      return res.status(200).json({
        success: true,
        message: "Webhook event already processed",
      });
    }

    if (
      existingEvent &&
      existingEvent.status === "PROCESSING"
    ) {
      return res.status(500).json({
        success: false,
        message: "Webhook event is already being processed",
      });
    }

    // A failed or otherwise incomplete event needs recovery.
    return res.status(500).json({
      success: false,
      message: "Duplicate webhook event requires recovery",
    });
    }

    console.log("Webhook event recorded:", webhookRecord.id);

    // Mark the event as processing
    webhookRecord = await prisma.webhookEvent.update({
    where: {
      id: webhookRecord.id,
    },
    data: {
      status: "PROCESSING",
      processingAttempts: {
        increment: 1,
      },
    },
    });

    // Handle failed payment

    if (event === "payment.failed") {
      const failedPayment = await prisma.payment.updateMany({
        where: {
          gateway: "RAZORPAY",
          gatewayOrderId: razorpayOrderId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          gatewayPaymentId: razorpayPaymentId,
          webhookEventId: null,
        },
      });

      if (failedPayment.count === 0) {
        await prisma.webhookEvent.update({
          where: {
            id: webhookRecord.id,
          },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            lastError: null,
          },
        });
      
        return res.status(200).json({
          success: true,
          message: "Payment already processed or no pending payment found",
        });
      }

      
      await prisma.webhookEvent.update({
        where: {
          id: webhookRecord.id,
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          processingAttempts: {
            increment: 1,
          },
          lastError: null,
        },
      });
      
      console.log(
        "Razorpay payment failed:",
        razorpayPaymentId
      );
      
      return res.status(200).json({
        success: true,
        message: "Payment failure recorded",
      });
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
    
      await prisma.webhookEvent.update({
        where: {
          id: webhookRecord.id,
        },
        data: {
          status: "FAILED",
          lastError: "Payment record not found",
        },
      });
    
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

      await prisma.webhookEvent.update({
        where: {
          id: webhookRecord.id,
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          lastError: null,
        },
      });

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
          webhookEventId: null,
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

      // Atomically create today's counter if it doesn't exist.
      await tx.dailyTokenCounter.upsert({
        where: {
          counterDate: today,
        },
        create: {
          counterDate: today,
          lastToken: 100,
        },
        update: {},
      });

      // Increment the counter atomically.
      const counter = await tx.dailyTokenCounter.update({
        where: {
          counterDate: today,
        },
        data: {
          lastToken: {
            increment: 1,
          },
        },
      });

      const tokenNumber = counter.lastToken;

      // Release order
      const updatedOrder =
        await tx.order.update({
          where: {
            id: payment.order.id,
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
      await prisma.webhookEvent.update({
        where: {
          id: webhookRecord.id,
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          lastError: null,
        },
      });
    
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // Mark webhook event as processed after the transaction succeeds
      await prisma.webhookEvent.update({
        where: {
          id: webhookRecord.id,
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          processingAttempts: {
            increment: 1,
          },
          lastError: null,
        },
      });

      console.log(
        "Webhook event processed:",
        webhookRecord.id
      );

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
    console.error("Webhook processing error:", error);
  
    if (webhookRecord?.id) {
      try {
        await prisma.webhookEvent.update({
          where: {
            id: webhookRecord.id,
          },
          data: {
            status: "FAILED",
            lastError: String(error.message || error).slice(0, 1000),
          },
        });
      } catch (recordError) {
        console.error(
          "Failed to record webhook error:",
          recordError
        );
      }
    }
  
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
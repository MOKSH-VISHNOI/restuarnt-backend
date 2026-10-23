const crypto = require("crypto");
const defaultPrisma = require("../config/prisma");
const defaultGateway = require("../services/razorpayService");
const { MAX_PAYMENT_ATTEMPTS, getPaymentSummary } = require("../utils/paymentSummary");
const SUPPORTED_CURRENCY = "INR";

class PaymentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseOrderId(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isGatewayId(value, prefix) {
  return typeof value === "string" && value.length <= 255 &&
    new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value);
}

function secureHexEqual(expected, actual) {
  if (typeof actual !== "string" || !/^[a-f\d]{64}$/i.test(actual)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(actual, "hex");
  return expectedBytes.length === actualBytes.length &&
    crypto.timingSafeEqual(expectedBytes, actualBytes);
}

function minorUnits(amount) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function isDefinitiveGatewayRejection(error) {
  const status = Number(error?.statusCode || error?.status);
  return status === 400 || status === 422;
}

function isWaterOnly(order) {
  return Array.isArray(order?.items) && order.items.length > 0 &&
    order.items.every((item) => item.menuItem?.name?.toLowerCase().includes("water"));
}

function validateAuthoritativePayment(gatewayPayment, payment, expectedPaymentId, expectedStatus) {
  if (!gatewayPayment || gatewayPayment.id !== expectedPaymentId) {
    throw new PaymentError(400, "PAYMENT_MISMATCH", "Payment does not match the submitted payment ID");
  }
  if (gatewayPayment.order_id !== payment.gatewayOrderId) {
    throw new PaymentError(400, "PAYMENT_ORDER_MISMATCH", "Payment does not belong to this order");
  }
  if (gatewayPayment.amount !== minorUnits(payment.amount)) {
    throw new PaymentError(400, "PAYMENT_AMOUNT_MISMATCH", "Payment amount does not match the order total");
  }
  if (String(gatewayPayment.currency || "").toUpperCase() !== SUPPORTED_CURRENCY) {
    throw new PaymentError(400, "PAYMENT_CURRENCY_MISMATCH", "Payment currency does not match the order currency");
  }
  if (expectedStatus && gatewayPayment.status !== expectedStatus) {
    if (gatewayPayment.status === "authorized") {
      throw new PaymentError(409, "PAYMENT_NOT_CAPTURED", "Payment is authorized but has not been captured yet");
    }
    throw new PaymentError(409, "PAYMENT_NOT_CAPTURED", "Payment has not been captured");
  }
}

function createPaymentController({
  prisma = defaultPrisma,
  gateway = defaultGateway,
  env = process.env,
  now = () => new Date(),
  logger = console,
} = {}) {
  const orderWithItems = {
    items: { include: { menuItem: true } },
  };
  const orderWithPayments = {
    payments: { include: { transactions: true } },
    ...orderWithItems,
  };

  function notifyOrder(req, order) {
    const io = req?.app?.get?.("io");
    if (!io?.emit || !order) return;

    const events = [["ORDER_STATUS_UPDATED", {
      orderId: order.id,
      tokenNumber: order.tokenNumber,
      status: order.status,
    }]];

    if (order.status === "PAYMENT_ABANDONED") {
      events.push(["PAYMENT_ATTEMPTS_EXHAUSTED", order]);
    } else if (order.status === "READY") {
      events.push(["ORDER_READY", order], ["DISPLAY_REFRESH"]);
    } else if (order.status === "PLACED") {
      events.push(["NEW_ORDER", order]);
    }
    for (const [event, payload] of events) {
      try {
        io.emit(event, payload);
      } catch (error) {
        logger.error("Socket notification failed after payment confirmation:", event, error);
      }
    }
  }

  function respondError(res, error, fallbackMessage) {
    if (error instanceof PaymentError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "IDEMPOTENCY_CONFLICT",
        message: "This payment request is already being processed. Retry shortly.",
      });
    }
    logger.error(fallbackMessage, error);
    return res.status(500).json({ success: false, message: fallbackMessage });
  }

  async function getPaymentAndOrder(tx, paymentId) {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { payment: null, order: null };
    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: orderWithItems,
    });
    return { payment, order };
  }

  async function getCurrentOrderPayment(orderId, paymentId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderWithPayments,
    });
    const payment = (order?.payments || []).find((item) => item.id === paymentId) || null;
    return { payment, order };
  }

  function withPaymentSummary(order) {
    return order ? { ...order, ...getPaymentSummary(order) } : order;
  }

  function transactionStatusFor(gatewayStatus) {
    switch (gatewayStatus) {
      case "authorized": return "AUTHORIZED";
      case "failed": return "FAILED";
      case "captured": return "CAPTURED";
      case "refunded": return "REFUNDED";
      case "partially_refunded": return "PARTIALLY_REFUNDED";
      default: return "PENDING";
    }
  }

  async function recordGatewayTransaction(tx, payment, gatewayPayment) {
    if (!isGatewayId(gatewayPayment?.id, "pay")) {
      throw new PaymentError(400, "INVALID_GATEWAY_PAYMENT_ID", "Razorpay payment ID is invalid");
    }
    const existing = await tx.paymentTransaction.findUnique({
      where: { gatewayPaymentId: gatewayPayment.id },
    });
    if (existing && existing.paymentId !== payment.id) {
      throw new PaymentError(409, "PAYMENT_TRANSACTION_CONFLICT", "Razorpay payment is already attached to another payment order");
    }

    const transactionData = {
      status: transactionStatusFor(gatewayPayment.status),
      amountMinor: gatewayPayment.amount,
      currency: String(gatewayPayment.currency || SUPPORTED_CURRENCY).toUpperCase(),
      method: typeof gatewayPayment.method === "string" ? gatewayPayment.method : null,
    };

    if (existing && existing.status === transactionData.status &&
      existing.amountMinor === transactionData.amountMinor && existing.currency === transactionData.currency &&
      existing.method === transactionData.method) {
      return existing;
    }

    return tx.paymentTransaction.upsert({
      where: { gatewayPaymentId: gatewayPayment.id },
      create: {
        paymentId: payment.id,
        gatewayPaymentId: gatewayPayment.id,
        ...transactionData,
      },
      update: transactionData,
    });
  }

  async function getCapturedPaymentIdsForOrder(tx, orderId) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payments: { include: { transactions: true } } },
    });
    const ids = new Set();
    for (const payment of order?.payments || []) {
      if (payment.gateway !== "RAZORPAY") continue;
      for (const transaction of payment.transactions || []) {
        if (transaction.status === "CAPTURED" && transaction.gatewayPaymentId?.startsWith("pay_")) {
          ids.add(transaction.gatewayPaymentId);
        }
      }
      // Preserve visibility for legacy successful attempts created before the
      // transaction ledger existed. New captures are always recorded above.
      if (payment.status === "SUCCESS" && payment.gatewayPaymentId?.startsWith("pay_")) {
        ids.add(payment.gatewayPaymentId);
      }
    }
    return ids;
  }

  async function recordUnresolvedGatewayPayment(paymentId, gatewayPayment) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment was not found");
      validateAuthoritativePayment(gatewayPayment, payment, gatewayPayment.id);
      return recordGatewayTransaction(tx, payment, gatewayPayment);
    });
  }

  async function abandonOrderIfAttemptsExhausted(tx, orderId) {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderWithPayments });
    if (!order || order.status !== "PENDING_PAYMENT" || order.tokenNumber != null ||
      getPaymentSummary(order).paymentState !== "ATTEMPTS_EXHAUSTED") return false;
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT", tokenNumber: null },
      data: { status: "PAYMENT_ABANDONED" },
    });
    return updated.count > 0;
  }

  async function finalizeAttemptLimit(orderId) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${orderId})`;
      return abandonOrderIfAttemptsExhausted(tx, orderId);
    });
  }

  async function recordFailedPayment({ paymentId, gatewayPayment, webhookEventId, transactionClient, req }) {
    let result;
    const applyFailure = async (tx) => {
      const paymentInfo = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!paymentInfo) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment was not found");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${paymentInfo.orderId})`;
      const { payment, order } = await getPaymentAndOrder(tx, paymentId);
      if (!payment || !order) {
        throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment or order was not found");
      }

      validateAuthoritativePayment(gatewayPayment, payment, gatewayPayment.id, "failed");
      await recordGatewayTransaction(tx, payment, gatewayPayment);
      if (payment.status !== "SUCCESS" && !["REFUNDED", "PARTIALLY_REFUNDED"].includes(payment.status)) {
        if (payment.status === "PENDING") {
          await tx.payment.updateMany({
            where: { id: payment.id, status: "PENDING" },
            data: { status: "PROCESSING" },
          });
        }
        await tx.payment.updateMany({
          where: { id: payment.id, status: "PROCESSING" },
          data: {
            status: "FAILED",
            gatewayPaymentId: gatewayPayment.id,
            ...(webhookEventId ? { webhookEventId: String(webhookEventId) } : {}),
          },
        });
      }

      const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
      let currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: orderWithPayments,
      });
      if (currentPayment?.status === "FAILED" && await abandonOrderIfAttemptsExhausted(tx, order.id)) {
        currentOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: orderWithPayments,
        });
      }
      result = { payment: currentPayment, order: currentOrder, failed: currentPayment?.status === "FAILED" };
    };

    if (transactionClient) await applyFailure(transactionClient);
    else await prisma.$transaction(applyFailure);
    if (!transactionClient && result?.order?.status === "PAYMENT_ABANDONED") notifyOrder(req, result.order);
    return result;
  }

  // Claims the order row before incrementing the daily counter. The row condition
  // guarantees that concurrent captures for separate attempts cannot issue two tokens.
  async function confirmCapturedPayment({ paymentId, gatewayPayment, webhookEventId, transactionClient }) {
    let result;
    const applyConfirmation = async (tx) => {
      const paymentInfo = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!paymentInfo) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment was not found");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${paymentInfo.orderId})`;
      const { payment, order } = await getPaymentAndOrder(tx, paymentId);
      if (!payment || !order) {
        throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment or order was not found");
      }

      validateAuthoritativePayment(gatewayPayment, payment, gatewayPayment.id, "captured");

      if (payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
        throw new PaymentError(409, "PAYMENT_NOT_FULFILLABLE", "A refunded payment cannot release an order");
      }

      const previousTransaction = await tx.paymentTransaction.findUnique({
        where: { gatewayPaymentId: gatewayPayment.id },
      });
      await recordGatewayTransaction(tx, payment, gatewayPayment);
      const capturedPaymentIds = await getCapturedPaymentIdsForOrder(tx, order.id);
      const additionalCaptureNeedsReconciliation = capturedPaymentIds.size > 1;
      const additionalCaptureDetected = additionalCaptureNeedsReconciliation &&
        previousTransaction?.status !== "CAPTURED";

      // Legacy/recovery attempts may still be PENDING when a gateway result
      // arrives. Advance them through PROCESSING in the same transaction.
      if (payment.status === "PENDING") {
        await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "PROCESSING" },
        });
      }

      const paymentClaim = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["PROCESSING", "FAILED", "CANCELLED", "TIMED_OUT"] } },
        data: {
          status: "SUCCESS",
          gatewayPaymentId: gatewayPayment.id,
          ...(webhookEventId ? { webhookEventId: String(webhookEventId) } : {}),
        },
      });

      const canRelease = ["PENDING_PAYMENT", "PAYMENT_ABANDONED"].includes(order.status) && order.tokenNumber == null;
      if (!canRelease) {
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        result = {
          payment: currentPayment,
          order,
          fulfilled: false,
          paymentChanged: paymentClaim.count > 0,
          additionalCaptureNeedsReconciliation,
          additionalCaptureDetected,
        };
        return;
      }

      const readyImmediately = isWaterOnly(order);
      const timestamp = now();
      const orderClaim = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["PENDING_PAYMENT", "PAYMENT_ABANDONED"] }, tokenNumber: null },
        data: {
          status: readyImmediately ? "READY" : "PLACED",
          placedAt: timestamp,
          ...(readyImmediately ? { readyAt: timestamp } : {}),
        },
      });

      if (orderClaim.count === 0) {
        const currentOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: orderWithItems,
        });
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        result = {
          payment: currentPayment,
          order: currentOrder,
          fulfilled: false,
          paymentChanged: paymentClaim.count > 0,
          additionalCaptureNeedsReconciliation,
          additionalCaptureDetected,
        };
        return;
      }

      const today = now();
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
      const releasedOrder = await tx.order.update({
        where: { id: order.id },
        data: { tokenNumber: counter.lastToken },
        include: orderWithItems,
      });
      const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
      result = {
        payment: currentPayment,
        order: releasedOrder,
        fulfilled: true,
        paymentChanged: paymentClaim.count > 0,
        additionalCaptureNeedsReconciliation,
        additionalCaptureDetected,
      };
    };
    if (transactionClient) {
      await applyConfirmation(transactionClient);
    } else {
      await prisma.$transaction(applyConfirmation);
    }
    return result;
  }

  async function verifyGatewayPayment(payment, paymentId) {
    let gatewayPayment;
    try {
      gatewayPayment = await gateway.fetchPaymentById(paymentId);
    } catch (error) {
      throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not confirm payment status with Razorpay. Please retry shortly.");
    }
    validateAuthoritativePayment(gatewayPayment, payment, paymentId);
    return gatewayPayment;
  }

  async function reconcilePendingPayment(payment, req) {
    if (!payment.gatewayOrderId || payment.status === "SUCCESS") return null;
    let payments;
    try {
      payments = await gateway.fetchPaymentsForOrder(payment.gatewayOrderId);
    } catch (error) {
      throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not reconcile payment with Razorpay. Please retry shortly.");
    }
    const candidates = payments || [];
    let latestFailure = null;
    let capturedResult = null;
    let hasUnresolvedPayment = false;
    let additionalCaptureNeedsReconciliation = false;
    let additionalCaptureDetected = false;

    // A Razorpay order can contain several distinct payment IDs after Checkout
    // retries. Persist every authoritative transaction, not just the last one.
    for (const candidate of candidates) {
      if (!candidate?.id) continue;
      const gatewayPayment = await verifyGatewayPayment(payment, candidate.id);
      if (gatewayPayment.status === "captured") {
        const result = await confirmCapturedPayment({ paymentId: payment.id, gatewayPayment });
        if (result.fulfilled) notifyOrder(req, result.order);
        additionalCaptureNeedsReconciliation ||= result.additionalCaptureNeedsReconciliation === true;
        additionalCaptureDetected ||= result.additionalCaptureDetected === true;
        capturedResult ||= result;
      } else if (gatewayPayment.status === "failed") {
        latestFailure = await recordFailedPayment({ paymentId: payment.id, gatewayPayment, req });
      } else {
        await recordUnresolvedGatewayPayment(payment.id, gatewayPayment);
        hasUnresolvedPayment = true;
      }
    }

    if (capturedResult) {
      return {
        ...capturedResult,
        additionalCaptureNeedsReconciliation,
        additionalCaptureDetected,
      };
    }
    if (hasUnresolvedPayment) return { unresolved: true };
    return latestFailure;
  }

  async function createPaymentOrder(req, res) {
    try {
      const { orderId, idempotencyKey } = req.body || {};
      const numericOrderId = parseOrderId(orderId);
      if (!numericOrderId) {
        throw new PaymentError(400, "INVALID_ORDER_ID", "A valid orderId is required");
      }
      if (typeof idempotencyKey !== "string" || idempotencyKey.trim() !== idempotencyKey ||
        idempotencyKey.length < 10 || idempotencyKey.length > 200) {
        throw new PaymentError(400, "INVALID_IDEMPOTENCY_KEY", "A valid idempotencyKey is required");
      }
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new PaymentError(503, "PAYMENT_SETUP_UNAVAILABLE", "Online payment is not configured. Please contact the restaurant.");
      }

      const reservation = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numericOrderId})`;
        const order = await tx.order.findUnique({
          where: { id: numericOrderId },
          include: { payments: { include: { transactions: true } } },
        });
        if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Order not found");
        if (order.status === "PAYMENT_ABANDONED") {
          throw new PaymentError(429, "PAYMENT_ATTEMPT_LIMIT", "Maximum payment attempts reached for this order. Please contact the restaurant.");
        }
        if (order.status !== "PENDING_PAYMENT" || order.tokenNumber != null) {
          throw new PaymentError(409, "ORDER_NOT_AWAITING_PAYMENT", "This order is not awaiting payment");
        }

        const paymentAttempts = (order.payments || []).filter((item) => item.gateway === "RAZORPAY");
        if (paymentAttempts.some((item) => item.status === "SUCCESS")) {
          throw new PaymentError(409, "ORDER_ALREADY_PAID", "This order has already been paid");
        }
        const paymentAttemptsUsed = getPaymentSummary(order).paymentAttemptsUsed;

        const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
        if (existing && (existing.orderId !== numericOrderId || existing.gateway !== "RAZORPAY")) {
          throw new PaymentError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key is already in use");
        }
        if (existing && ["FAILED", "CANCELLED", "TIMED_OUT"].includes(existing.status)) {
          throw new PaymentError(409, "PAYMENT_ATTEMPT_FAILED", "This payment attempt failed. Start a new attempt.");
        }
        if (existing) {
          if (!existing.gatewayOrderId) {
            return { order, recoveryAttempt: existing };
          }
          return { order, existingAttempt: existing };
        }

        const activeAttempt = paymentAttempts.find((item) =>
          ["PENDING", "PROCESSING"].includes(item.status) ||
          (item.status !== "TIMED_OUT" && item.status !== "CANCELLED" &&
            (item.transactions || []).some((transaction) => ["PENDING", "AUTHORIZED"].includes(transaction.status))),
        );
        if (activeAttempt) {
          if (!activeAttempt.gatewayOrderId) {
            return { order, recoveryAttempt: activeAttempt };
          }
          return { order, existingAttempt: activeAttempt };
        }

        if (paymentAttemptsUsed >= MAX_PAYMENT_ATTEMPTS) {
          await tx.order.updateMany({
            where: { id: numericOrderId, status: "PENDING_PAYMENT", tokenNumber: null },
            data: { status: "PAYMENT_ABANDONED" },
          });
          return { order: { ...order, status: "PAYMENT_ABANDONED" }, attemptLimitReached: true };
        }

        const amountInPaise = minorUnits(order.totalAmount);
        if (!amountInPaise) {
          throw new PaymentError(400, "INVALID_ORDER_AMOUNT", "The order total is invalid");
        }
        const payment = await tx.payment.create({
          data: {
            orderId: numericOrderId,
            amount: order.totalAmount,
            status: "PENDING",
            gateway: "RAZORPAY",
            idempotencyKey,
            expiresAt: new Date(now().getTime() + 15 * 60 * 1000),
          },
        });
        return { order, payment };
      });

      if (reservation.attemptLimitReached) {
        notifyOrder(req, reservation.order);
        return res.status(429).json({
          success: false,
          code: "PAYMENT_ATTEMPT_LIMIT",
          message: "Maximum payment attempts reached for this order. Please contact the restaurant.",
        });
      }

      if (reservation.recoveryAttempt) {
        const attempt = reservation.recoveryAttempt;
        const receipt = `ORDER_${attempt.orderId}_PAYMENT_${attempt.id}`;
        let recoveredOrder;
        try {
          recoveredOrder = await gateway.findRazorpayOrderByReceipt(receipt);
        } catch (error) {
          logger.error("Could not reconcile reserved Razorpay payment:", attempt.id, error);
          return res.status(502).json({
            success: false,
            code: "PAYMENT_ATTEMPT_UNRESOLVED",
            message: "Payment setup is still being reconciled. Retry shortly; do not start another payment.",
          });
        }
        if (!recoveredOrder) {
          return res.status(409).json({
            success: false,
            code: "PAYMENT_ATTEMPT_UNRESOLVED",
            message: "Payment setup is still being reconciled. Retry shortly; do not start another payment.",
          });
        }
        if (!isGatewayId(recoveredOrder.id, "order") || recoveredOrder.receipt !== receipt ||
          recoveredOrder.amount !== minorUnits(attempt.amount) ||
          String(recoveredOrder.currency || "").toUpperCase() !== SUPPORTED_CURRENCY) {
          return res.status(502).json({
            success: false,
            code: "PAYMENT_ATTEMPT_UNRESOLVED",
            message: "The existing Razorpay order could not be safely matched to this payment. Contact the restaurant.",
          });
        }

        let attached;
        try {
          const saved = await prisma.payment.updateMany({
            where: { id: attempt.id, status: { in: ["PENDING", "PROCESSING"] }, gatewayOrderId: null },
            data: { gatewayOrderId: recoveredOrder.id, status: "PROCESSING" },
          });
          attached = await prisma.payment.findUnique({ where: { id: attempt.id } });
          if (saved.count === 0 && attached?.gatewayOrderId !== recoveredOrder.id) {
            throw new Error("Payment attempt changed during gateway reconciliation");
          }
        } catch (error) {
          logger.error("Could not save recovered Razorpay order:", attempt.id, error);
          return res.status(502).json({
            success: false,
            code: "PAYMENT_ATTEMPT_UNRESOLVED",
            message: "Payment setup is still being reconciled. Retry shortly; do not start another payment.",
          });
        }

        const reconciliation = await reconcilePendingPayment(attached, req);
        if (reconciliation?.fulfilled) {
          return res.status(200).json({
            success: true,
            message: "Payment was confirmed",
            payment: reconciliation.payment,
            order: reconciliation.order,
          });
        }
        if (reconciliation?.unresolved) {
          throw new PaymentError(409, "PAYMENT_OUTCOME_UNRESOLVED", "Razorpay reports an authorized payment that is not captured yet. Do not start another attempt until its status is confirmed.");
        }
        const current = await getCurrentOrderPayment(attempt.orderId, attempt.id);
        if (!current.payment || !current.order) {
          throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment or order was not found");
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(current.payment.status)) {
          throw new PaymentError(409, "PAYMENT_ATTEMPT_FAILED", "This payment attempt failed. Start a new attempt.");
        }
        if (current.payment.status === "SUCCESS") {
          return res.status(200).json({
            success: true,
            message: "Payment was confirmed",
            payment: current.payment,
            order: current.order,
          });
        }
        if (current.order.status !== "PENDING_PAYMENT") {
          throw new PaymentError(409, "ORDER_ALREADY_RELEASED", "This order has already been confirmed. Check its status before trying to pay again.");
        }
        if (recoveredOrder.status === "paid") {
          return res.status(502).json({
            success: false,
            code: "PAYMENT_RECONCILIATION_PENDING",
            message: "Razorpay reports this order as paid. Confirmation is still being reconciled; do not pay again.",
          });
        }
        return res.status(200).json({
          success: true,
          message: "Recovered existing payment attempt",
          order: { id: current.order.id, amount: current.order.totalAmount, currency: SUPPORTED_CURRENCY },
          payment: current.payment,
          razorpayOrder: recoveredOrder,
        });
      }

      if (reservation.existingAttempt) {
        const reconciliation = await reconcilePendingPayment(reservation.existingAttempt, req);
        if (reconciliation?.order && reconciliation.order.status !== "PENDING_PAYMENT") {
          return res.status(200).json({
            success: true,
            message: "Payment was confirmed",
            payment: reconciliation.payment,
            order: reconciliation.order,
          });
        }
        if (reconciliation?.unresolved) {
          throw new PaymentError(409, "PAYMENT_OUTCOME_UNRESOLVED", "Razorpay reports an authorized payment that is not captured yet. Do not start another attempt until its status is confirmed.");
        }
        const current = await getCurrentOrderPayment(reservation.order.id, reservation.existingAttempt.id);
        if (!current.payment || !current.order) {
          throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment or order was not found");
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(current.payment.status)) {
          throw new PaymentError(409, "PAYMENT_ATTEMPT_FAILED", "This payment attempt failed. Start a new attempt.");
        }
        if (current.payment.status === "SUCCESS") {
          return res.status(200).json({
            success: true,
            message: "Payment was confirmed",
            payment: current.payment,
            order: current.order,
          });
        }
        if (current.order.status !== "PENDING_PAYMENT") {
          throw new PaymentError(409, "ORDER_ALREADY_RELEASED", "This order has already been confirmed. Check its status before trying to pay again.");
        }
        const existing = current.payment;
        return res.status(200).json({
          success: true,
          message: "Existing payment attempt returned",
          order: { id: current.order.id, amount: current.order.totalAmount, currency: SUPPORTED_CURRENCY },
          payment: existing,
          razorpayOrder: {
            id: existing.gatewayOrderId,
            amount: minorUnits(existing.amount),
            currency: SUPPORTED_CURRENCY,
          },
        });
      }

      const payment = reservation.payment;
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "PROCESSING" },
      });
      const activePayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (!activePayment || activePayment.status !== "PROCESSING") {
        throw new PaymentError(409, "PAYMENT_ATTEMPT_FAILED", "This payment attempt is no longer active. Start a new attempt after checking its status.");
      }

      let razorpayOrder;
      try {
        razorpayOrder = await gateway.createRazorpayOrder({
          amount: payment.amount,
          receipt: `ORDER_${payment.orderId}_PAYMENT_${payment.id}`,
        });
      } catch (error) {
        logger.error("Razorpay order creation failed for reserved payment:", payment.id, error);
        if (isDefinitiveGatewayRejection(error)) {
          try {
            const failed = await prisma.payment.updateMany({
              where: { id: payment.id, status: "PROCESSING", gatewayOrderId: null },
              data: { status: "FAILED" },
            });
            if (failed.count > 0) {
              const abandoned = await finalizeAttemptLimit(numericOrderId);
              if (abandoned) {
                const updatedOrder = await prisma.order.findUnique({
                  where: { id: numericOrderId },
                  include: orderWithPayments,
                });
                notifyOrder(req, updatedOrder);
                return res.status(429).json({
                  success: false,
                  code: "PAYMENT_ATTEMPT_LIMIT",
                  message: "Maximum payment attempts reached for this order. Please contact the restaurant.",
                });
              }
              return res.status(502).json({
                success: false,
                code: "PAYMENT_ATTEMPT_FAILED",
                message: "Razorpay rejected payment setup. You can safely retry the payment.",
              });
            }
          } catch (recordError) {
            logger.error("Could not record definitive Razorpay setup failure:", payment.id, recordError);
          }
        }
        return res.status(502).json({
          success: false,
          code: "PAYMENT_ATTEMPT_UNRESOLVED",
          message: "Payment setup could not be confirmed. Do not retry with a new payment; contact the restaurant for help.",
        });
      }

      if (!isGatewayId(razorpayOrder?.id, "order") || razorpayOrder.amount !== minorUnits(payment.amount) ||
        String(razorpayOrder.currency || "").toUpperCase() !== SUPPORTED_CURRENCY) {
        return res.status(502).json({
          success: false,
          code: "PAYMENT_ATTEMPT_UNRESOLVED",
          message: "Razorpay returned an unexpected payment order. Contact the restaurant before retrying.",
        });
      }

      let updatedPayment;
      try {
        updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            gatewayOrderId: razorpayOrder.id,
            status: "PROCESSING",
          },
        });
      } catch (error) {
        logger.error("Failed to persist Razorpay order for payment attempt:", payment.id, error);
        return res.status(502).json({
          success: false,
          code: "PAYMENT_ATTEMPT_UNRESOLVED",
          message: "Razorpay created a payment order but it could not be saved. Do not retry; contact the restaurant for recovery.",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Payment order created successfully",
        order: { id: payment.orderId, amount: payment.amount, currency: SUPPORTED_CURRENCY },
        payment: updatedPayment,
        razorpayOrder,
      });
    } catch (error) {
      return respondError(res, error, "Failed to create payment order");
    }
  }

  async function verifyRazorpayPayment(req, res) {
    try {
      const {
        orderId,
        razorpay_payment_id: paymentId,
        razorpay_order_id: gatewayOrderId,
        razorpay_signature: signature,
      } = req.body || {};
      const numericOrderId = parseOrderId(orderId);
      if (!numericOrderId || !isGatewayId(paymentId, "pay") || !isGatewayId(gatewayOrderId, "order") ||
        typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) {
        throw new PaymentError(400, "INVALID_VERIFICATION_REQUEST", "Valid order, payment, Razorpay order, and signature values are required");
      }
      if (!env.RAZORPAY_KEY_SECRET) {
        throw new PaymentError(503, "PAYMENT_VERIFICATION_UNAVAILABLE", "Payment verification is not configured");
      }

      const order = await prisma.order.findUnique({
        where: { id: numericOrderId },
        include: orderWithPayments,
      });
      if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Order not found");

      let gatewayPayment;
      try {
        gatewayPayment = await gateway.fetchPaymentById(paymentId);
      } catch (error) {
        throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not confirm payment status with Razorpay. Please retry shortly.");
      }
      if (!gatewayPayment || gatewayPayment.id !== paymentId || !isGatewayId(gatewayPayment.order_id, "order")) {
        throw new PaymentError(400, "PAYMENT_MISMATCH", "Razorpay returned payment details that do not match the submitted payment");
      }

      // The Checkout response's order ID can be stale if callbacks overlap.
      // Bind verification to Razorpay's fetched payment, then scope the lookup
      // to this restaurant order so a payment from another order cannot release it.
      const payment = (order.payments || []).find((item) =>
        item.gateway === "RAZORPAY" && item.gatewayOrderId === gatewayPayment.order_id,
      );
      if (!payment) {
        throw new PaymentError(404, "PAYMENT_ATTEMPT_NOT_FOUND", "Razorpay payment is not attached to this restaurant order");
      }

      const expectedSignature = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET)
        .update(`${gatewayPayment.order_id}|${paymentId}`)
        .digest("hex");
      if (!secureHexEqual(expectedSignature, signature)) {
        throw new PaymentError(400, "INVALID_PAYMENT_SIGNATURE", "Payment signature verification failed");
      }

      validateAuthoritativePayment(gatewayPayment, payment, paymentId);
      if (gatewayPayment.status !== "captured") {
        if (gatewayPayment.status === "failed") {
          await recordFailedPayment({ paymentId: payment.id, gatewayPayment, req });
          throw new PaymentError(409, "PAYMENT_FAILED", "Razorpay reports that this payment failed. You can start a new attempt.");
        }
        await recordUnresolvedGatewayPayment(payment.id, gatewayPayment);
        throw new PaymentError(409, "PAYMENT_NOT_CAPTURED", "Payment is not captured yet. Your order has not been sent to the kitchen.");
      }

      const result = await confirmCapturedPayment({ paymentId: payment.id, gatewayPayment });
      if (result.fulfilled) notifyOrder(req, result.order);
      return res.status(200).json({
        success: true,
        message: result.fulfilled ? "Payment verified and order released" : "Payment already processed",
        additionalCaptureNeedsReconciliation: result.additionalCaptureNeedsReconciliation,
        additionalCaptureDetected: result.additionalCaptureDetected,
        payment: result.payment,
        order: result.order,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("Payment verification error:", error);
      return res.status(500).json({ success: false, message: "Payment verification failed. Please retry or check your order status." });
    }
  }

  // Razorpay Checkout includes the failed payment ID in its failure callback.
  // Fetch that exact payment from Razorpay so a delayed/incomplete order-payment
  // listing cannot leave a definitively failed attempt marked PENDING.
  async function reconcileCheckoutFailure(req, res) {
    try {
      const {
        orderId,
        razorpay_order_id: gatewayOrderId,
        razorpay_payment_id: paymentId,
      } = req.body || {};
      const numericOrderId = parseOrderId(orderId);
      if (!numericOrderId || !isGatewayId(gatewayOrderId, "order") || !isGatewayId(paymentId, "pay")) {
        throw new PaymentError(400, "INVALID_RECONCILIATION_REQUEST", "Valid order, Razorpay order, and payment IDs are required");
      }

      const order = await prisma.order.findUnique({
        where: { id: numericOrderId },
        include: orderWithPayments,
      });
      if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Order not found");

      // The checkout failure callback can arrive late while the customer has
      // already opened another attempt. Treat its order ID as a hint and map
      // the fetched payment to the attempt identified by Razorpay itself.
      // Still require that attempt to belong to this exact restaurant order.
      let gatewayPayment;
      try {
        gatewayPayment = await gateway.fetchPaymentById(paymentId);
      } catch (error) {
        throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not confirm payment status with Razorpay. Please retry shortly.");
      }
      if (!gatewayPayment || gatewayPayment.id !== paymentId) {
        throw new PaymentError(400, "PAYMENT_MISMATCH", "Payment does not match the submitted payment ID");
      }
      const payment = (order.payments || []).find((item) =>
        item.gateway === "RAZORPAY" && item.gatewayOrderId === gatewayPayment.order_id,
      );
      if (!payment) {
        throw new PaymentError(404, "PAYMENT_ATTEMPT_NOT_FOUND", "Matching Razorpay payment was not found");
      }

      validateAuthoritativePayment(gatewayPayment, payment, paymentId);
      let result;
      let outcome = "UNRESOLVED";
      if (gatewayPayment.status === "captured") {
        result = await confirmCapturedPayment({ paymentId: payment.id, gatewayPayment });
        if (result.fulfilled) notifyOrder(req, result.order);
        outcome = "CAPTURED";
      } else if (gatewayPayment.status === "failed") {
        result = await recordFailedPayment({ paymentId: payment.id, gatewayPayment, req });
        outcome = result.failed ? "FAILED" : "UNRESOLVED";
      } else {
        await recordUnresolvedGatewayPayment(payment.id, gatewayPayment);
        result = {
          payment,
          order,
        };
      }

      const latestOrder = await prisma.order.findUnique({
        where: { id: numericOrderId },
        include: orderWithPayments,
      });

      return res.status(200).json({
        success: true,
        outcome,
        additionalCaptureNeedsReconciliation: result.additionalCaptureNeedsReconciliation === true ||
          getPaymentSummary(latestOrder || result.order).additionalCaptureNeedsReconciliation,
        additionalCaptureDetected: result.additionalCaptureDetected === true,
        message: outcome === "FAILED"
          ? "Razorpay confirmed the payment failure"
          : outcome === "CAPTURED"
            ? "Razorpay confirmed the captured payment"
            : "Razorpay has not reported a final payment outcome",
        payment: result.payment,
        order: withPaymentSummary(latestOrder || result.order),
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("Checkout failure reconciliation error:", error);
      return res.status(500).json({ success: false, message: "Could not reconcile the checkout result" });
    }
  }

  async function refundRazorpayPayment(req, res) {
    try {
      const { orderId, amount, idempotencyKey } = req.body || {};
      const numericOrderId = parseOrderId(orderId);
      if (!numericOrderId) {
        throw new PaymentError(400, "INVALID_ORDER_ID", "A valid orderId is required");
      }
      if (typeof idempotencyKey !== "string" || idempotencyKey.trim() !== idempotencyKey ||
        idempotencyKey.length < 10 || idempotencyKey.length > 200) {
        throw new PaymentError(400, "INVALID_IDEMPOTENCY_KEY", "A valid idempotencyKey is required for refunds");
      }

      let refundAmount = null;
      if (amount !== undefined && amount !== null) {
        refundAmount = Number(amount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0 ||
          Math.abs(refundAmount * 100 - Math.round(refundAmount * 100)) > 1e-7) {
          throw new PaymentError(400, "INVALID_REFUND_AMOUNT", "Refund amount must be a positive amount with no more than two decimal places");
        }
      }

      const reservation = await prisma.$transaction(async (tx) => {
        // Serialize and persist each reservation before contacting Razorpay.
        // This both prevents parallel over-refunds and makes a repeated client
        // request resolve to the same durable refund attempt.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numericOrderId})`;
        const order = await tx.order.findUnique({
          where: { id: numericOrderId },
          include: orderWithPayments,
        });
        if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Order not found");

        const priorRefund = await tx.paymentRefund.findUnique({ where: { idempotencyKey } });
        if (priorRefund) {
          if (!order.payments.some((item) => item.id === priorRefund.paymentId)) {
            throw new PaymentError(409, "REFUND_IDEMPOTENCY_CONFLICT", "This refund key belongs to a different order");
          }
          if (priorRefund.status === "PENDING") {
            throw new PaymentError(409, "REFUND_OUTCOME_UNRESOLVED", "This refund request is still being reconciled. Do not retry it with a new key.");
          }
          if (priorRefund.status === "FAILED") {
            throw new PaymentError(409, "REFUND_ATTEMPT_FAILED", "This refund request failed. Use a new idempotency key to retry.");
          }
          return { priorRefund, order };
        }

        const successfulPayment = (order.payments || []).find(
          (p) => p.gateway === "RAZORPAY" && ["SUCCESS", "PARTIALLY_REFUNDED"].includes(p.status) && p.gatewayPaymentId,
        );
        if (!successfulPayment) {
          throw new PaymentError(400, "REFUND_NOT_ELIGIBLE", "Order does not have a confirmed payment eligible for refund");
        }

        const activeRefunds = await tx.paymentRefund.findMany({
          where: { paymentId: successfulPayment.id, status: "PENDING" },
        });
        const originalMinor = Math.round(Number(successfulPayment.amount) * 100);
        const alreadyRefundedMinor = Math.round(Number(successfulPayment.refundedAmount || 0) * 100);
        const reservedMinor = alreadyRefundedMinor + activeRefunds.reduce((sum, refund) => sum + refund.amountMinor, 0);
        const remainingMinor = Math.max(0, originalMinor - reservedMinor);
        if (remainingMinor <= 0) {
          throw new PaymentError(400, "ALREADY_FULLY_REFUNDED", "This payment has already been fully refunded");
        }

        const targetMinor = refundAmount != null ? Math.round(refundAmount * 100) : remainingMinor;
        if (targetMinor > remainingMinor) {
          throw new PaymentError(400, "REFUND_EXCEEDS_PAYMENT", "Refund amount exceeds the remaining refundable amount");
        }
        const refundAttempt = await tx.paymentRefund.create({
          data: {
            paymentId: successfulPayment.id,
            idempotencyKey,
            amountMinor: targetMinor,
            currency: SUPPORTED_CURRENCY,
            status: "PENDING",
          },
        });
        return { refundAttempt, payment: successfulPayment };
      });

      if (reservation.priorRefund) {
        const currentOrder = await prisma.order.findUnique({
          where: { id: numericOrderId },
          include: orderWithPayments,
        });
        const currentPayment = (currentOrder?.payments || []).find((item) => item.id === reservation.priorRefund.paymentId);
        return res.status(200).json({
          success: true,
          message: "Refund request already processed",
          refund: {
            id: reservation.priorRefund.gatewayRefundId,
            amount: reservation.priorRefund.amountMinor / 100,
            currency: reservation.priorRefund.currency,
            status: currentPayment?.status || "SUCCESS",
          },
          payment: currentPayment,
          order: withPaymentSummary(currentOrder),
        });
      }

      const targetRefundAmount = reservation.refundAttempt.amountMinor / 100;
      let gatewayRefund;
      try {
        gatewayRefund = await gateway.refundPayment(reservation.payment.gatewayPaymentId, targetRefundAmount, idempotencyKey);
      } catch (gatewayError) {
        const status = Number(gatewayError?.statusCode || gatewayError?.status);
        if (status >= 400 && status < 500 && ![408, 409, 429].includes(status)) {
          await prisma.paymentRefund.update({ where: { id: reservation.refundAttempt.id }, data: { status: "FAILED" } });
          throw new PaymentError(502, "GATEWAY_REFUND_FAILED", "Razorpay rejected the refund. Use a new refund request after reviewing the payment.");
        }
        // Keep uncertain requests reserved. Retrying with a new key could refund
        // the customer twice if Razorpay accepted the original request.
        logger.error("Razorpay refund outcome is unresolved:", reservation.payment.id, status || gatewayError?.code || "gateway_error");
        throw new PaymentError(502, "REFUND_OUTCOME_UNRESOLVED", "Razorpay's refund outcome is unknown. Do not submit another refund until it is reconciled.");
      }
      if (!isGatewayId(gatewayRefund?.id, "rfnd") ||
        (gatewayRefund.amount != null && gatewayRefund.amount !== reservation.refundAttempt.amountMinor)) {
        throw new PaymentError(502, "REFUND_OUTCOME_UNRESOLVED", "Razorpay returned an incomplete refund response. Do not retry until it is reconciled.");
      }
      if (gatewayRefund.status !== "processed") {
        await prisma.paymentRefund.update({
          where: { id: reservation.refundAttempt.id },
          data: { gatewayRefundId: gatewayRefund.id },
        });
        throw new PaymentError(502, "REFUND_OUTCOME_UNRESOLVED", "Razorpay accepted the refund but has not confirmed completion. Do not retry until it is reconciled.");
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numericOrderId})`;
        const refundAttempt = await tx.paymentRefund.update({
          where: { id: reservation.refundAttempt.id },
          data: { gatewayRefundId: gatewayRefund.id, status: "SUCCESS", processedAt: now() },
        });
        const currentPayment = await tx.payment.findUnique({ where: { id: reservation.payment.id } });
        const newRefundedAmount = Math.round((Number(currentPayment.refundedAmount || 0) + targetRefundAmount) * 100) / 100;
        const isFullRefund = newRefundedAmount >= Number(currentPayment.amount);
        const newStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";
        const updatedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            refundedAmount: newRefundedAmount,
            status: newStatus,
            refundedAt: now(),
          },
        });

        await tx.paymentTransaction.upsert({
          where: { gatewayPaymentId: gatewayRefund.id },
          create: {
            paymentId: currentPayment.id,
            gatewayPaymentId: gatewayRefund.id,
            refundRequestKey: idempotencyKey,
            status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
            amountMinor: Math.round(targetRefundAmount * 100),
            currency: SUPPORTED_CURRENCY,
            method: currentPayment.method || "ONLINE",
          },
          update: {
            status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
            amountMinor: Math.round(targetRefundAmount * 100),
          },
        });

        const updatedOrder = await tx.order.findUnique({
          where: { id: numericOrderId },
          include: orderWithPayments,
        });

        return { payment: updatedPayment, order: updatedOrder, refund: gatewayRefund, refundAttempt, amount: targetRefundAmount, status: newStatus, isFullRefund };
      });

      const io = req?.app?.get?.("io");
      if (io?.emit) {
        io.emit("ORDER_REFUNDED", {
          orderId: numericOrderId,
          refundAmount: result.amount,
          status: result.status,
          order: result.order,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.isFullRefund ? "Payment refunded successfully" : "Partial refund processed successfully",
        refund: {
          id: result.refund.id,
          amount: result.amount,
          currency: SUPPORTED_CURRENCY,
          status: result.status,
        },
        payment: result.payment,
        order: withPaymentSummary(result.order),
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("Refund processing error:", error);
      return res.status(500).json({ success: false, message: "Failed to process refund" });
    }
  }

  async function reconcileRazorpayRefund(req, res) {
    try {
      const { orderId, idempotencyKey } = req.body || {};
      const numericOrderId = parseOrderId(orderId);
      if (!numericOrderId || typeof idempotencyKey !== "string" ||
        idempotencyKey.trim() !== idempotencyKey || idempotencyKey.length < 10 || idempotencyKey.length > 200) {
        throw new PaymentError(400, "INVALID_REFUND_RECONCILIATION", "Valid orderId and refund idempotencyKey are required");
      }

      const attempt = await prisma.paymentRefund.findUnique({ where: { idempotencyKey } });
      if (!attempt) throw new PaymentError(404, "REFUND_ATTEMPT_NOT_FOUND", "Refund attempt was not found");
      const payment = await prisma.payment.findUnique({ where: { id: attempt.paymentId } });
      if (!payment || payment.orderId !== numericOrderId) {
        throw new PaymentError(404, "REFUND_ATTEMPT_NOT_FOUND", "Refund attempt was not found for this order");
      }
      if (attempt.status === "SUCCESS" || attempt.status === "FAILED") {
        const order = await prisma.order.findUnique({ where: { id: numericOrderId }, include: orderWithPayments });
        return res.status(200).json({
          success: true,
          outcome: attempt.status,
          refund: { id: attempt.gatewayRefundId, amount: attempt.amountMinor / 100, status: attempt.status },
          order: withPaymentSummary(order),
        });
      }
      let refundId = attempt.gatewayRefundId;
      if (!refundId) {
        try {
          const recoveredRefund = await gateway.findRefundByIdempotencyKey(payment.gatewayPaymentId, idempotencyKey);
          refundId = recoveredRefund?.id || null;
        } catch (error) {
          throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not locate the refund with Razorpay. Retry reconciliation shortly.");
        }
        if (!refundId) {
          throw new PaymentError(409, "REFUND_MANUAL_REVIEW_REQUIRED", "Razorpay has not exposed this refund yet. Retry reconciliation; do not create another refund.");
        }
        await prisma.paymentRefund.update({ where: { id: attempt.id }, data: { gatewayRefundId: refundId } });
      }

      let gatewayRefund;
      try {
        gatewayRefund = await gateway.fetchRefundById(payment.gatewayPaymentId, refundId);
      } catch (error) {
        throw new PaymentError(502, "GATEWAY_UNAVAILABLE", "Could not check the refund status with Razorpay. Retry reconciliation shortly.");
      }
      if (!gatewayRefund || gatewayRefund.id !== refundId ||
        gatewayRefund.payment_id !== payment.gatewayPaymentId || gatewayRefund.amount !== attempt.amountMinor) {
        throw new PaymentError(409, "REFUND_DETAILS_MISMATCH", "Razorpay refund details do not match the recorded request");
      }
      if (gatewayRefund.status === "failed") {
        await prisma.paymentRefund.update({ where: { id: attempt.id }, data: { status: "FAILED" } });
        return res.status(200).json({ success: true, outcome: "FAILED", message: "Razorpay reports that the refund failed" });
      }
      if (gatewayRefund.status !== "processed") {
        return res.status(202).json({ success: true, outcome: "PENDING", message: "Razorpay has not completed this refund yet" });
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numericOrderId})`;
        const currentAttempt = await tx.paymentRefund.findUnique({ where: { id: attempt.id } });
        if (currentAttempt.status === "SUCCESS") {
          const currentOrder = await tx.order.findUnique({ where: { id: numericOrderId }, include: orderWithPayments });
          const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
          return { payment: currentPayment, order: currentOrder, alreadyProcessed: true };
        }
        const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        const refundedAmount = Math.round((Number(currentPayment.refundedAmount || 0) + attempt.amountMinor / 100) * 100) / 100;
        const isFullRefund = refundedAmount >= Number(currentPayment.amount);
        const status = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";
        const updatedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: { refundedAmount, status, refundedAt: now() },
        });
        await tx.paymentRefund.update({
          where: { id: attempt.id },
          data: { status: "SUCCESS", processedAt: now() },
        });
        await tx.paymentTransaction.upsert({
          where: { gatewayPaymentId: gatewayRefund.id },
          create: {
            paymentId: currentPayment.id,
            gatewayPaymentId: gatewayRefund.id,
            refundRequestKey: idempotencyKey,
            status,
            amountMinor: attempt.amountMinor,
            currency: SUPPORTED_CURRENCY,
            method: currentPayment.method || "ONLINE",
          },
          update: { status, amountMinor: attempt.amountMinor },
        });
        const updatedOrder = await tx.order.findUnique({ where: { id: numericOrderId }, include: orderWithPayments });
        return { payment: updatedPayment, order: updatedOrder, status };
      });

      const io = req?.app?.get?.("io");
      if (io?.emit && !result.alreadyProcessed) {
        io.emit("ORDER_REFUNDED", { orderId: numericOrderId, refundAmount: attempt.amountMinor / 100, status: result.status, order: result.order });
      }
      return res.status(200).json({
        success: true,
        outcome: result.alreadyProcessed ? "ALREADY_PROCESSED" : "SUCCESS",
        refund: { id: gatewayRefund.id, amount: attempt.amountMinor / 100, status: result.status || result.payment.status },
        payment: result.payment,
        order: withPaymentSummary(result.order),
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("Refund reconciliation failed:", error);
      return res.status(500).json({ success: false, message: "Failed to reconcile refund status" });
    }
  }

  async function handleRazorpayWebhook(req, res) {
    let webhookRecord = null;
    try {
      const rawBody = req.body;
      const signature = req.headers?.["x-razorpay-signature"];
      const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
      if (!Buffer.isBuffer(rawBody)) {
        throw new PaymentError(400, "INVALID_WEBHOOK_BODY", "Webhook raw body is required");
      }
      if (!webhookSecret) {
        throw new PaymentError(503, "WEBHOOK_UNAVAILABLE", "Webhook verification is not configured");
      }
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      if (!secureHexEqual(expectedSignature, signature)) {
        logger.warn("Rejected Razorpay webhook with an invalid signature");
        throw new PaymentError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature verification failed");
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        throw new PaymentError(400, "INVALID_WEBHOOK_PAYLOAD", "Webhook payload is invalid");
      }
      const eventType = payload?.event;
      if (eventType !== "payment.captured" && eventType !== "payment.failed") {
        return res.status(200).json({ success: true, message: "Event received but not handled" });
      }
      const eventPayment = payload?.payload?.payment?.entity;
      if (!isGatewayId(eventPayment?.id, "pay") || !isGatewayId(eventPayment?.order_id, "order")) {
        throw new PaymentError(400, "INVALID_WEBHOOK_PAYMENT", "Webhook payment details are missing or invalid");
      }

      const externalEventId = String(
        payload.id || req.headers["x-razorpay-event-id"] || `${eventType}:${eventPayment.id}`,
      );
      try {
        webhookRecord = await prisma.webhookEvent.create({
          data: {
            gateway: "RAZORPAY",
            eventType,
            externalEventId,
            gatewayPaymentId: eventPayment.id,
            gatewayOrderId: eventPayment.order_id,
            status: "RECEIVED",
          },
        });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        webhookRecord = await prisma.webhookEvent.findUnique({
          where: { gateway_externalEventId: { gateway: "RAZORPAY", externalEventId } },
        });
      }

      if (!webhookRecord) throw new Error("Webhook event could not be recorded");
      if (webhookRecord.status === "PROCESSED") {
        return res.status(200).json({ success: true, message: "Webhook event already processed" });
      }

      const payment = await prisma.payment.findFirst({
        where: { gateway: "RAZORPAY", gatewayOrderId: eventPayment.order_id },
        include: { order: { include: orderWithItems } },
      });
      if (!payment) {
        throw new PaymentError(503, "PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt is not available yet; retry the webhook");
      }
      if (!payment.order || payment.order.status === "PENDING_PAYMENT" && payment.order.tokenNumber != null) {
        throw new PaymentError(409, "ORDER_STATE_INVALID", "Payment order is not in a valid state");
      }

      let authoritativePayment;
      try {
        authoritativePayment = await gateway.fetchPaymentById(eventPayment.id);
      } catch {
        throw new PaymentError(503, "GATEWAY_UNAVAILABLE", "Could not confirm webhook payment with Razorpay; retry the webhook");
      }
      validateAuthoritativePayment(authoritativePayment, payment, eventPayment.id);
      const requiredStatus = eventType === "payment.captured" ? "captured" : "failed";
      if (authoritativePayment.status !== requiredStatus) {
        throw new PaymentError(409, "WEBHOOK_PAYMENT_STATUS_MISMATCH", "Webhook event does not match the authoritative payment status");
      }

      let transactionResult;
      await prisma.$transaction(async (tx) => {
        const claim = await tx.webhookEvent.updateMany({
          where: { id: webhookRecord.id, status: { in: ["RECEIVED", "FAILED", "PROCESSING"] } },
          data: { status: "PROCESSING", processingAttempts: { increment: 1 } },
        });
        if (claim.count === 0) {
          transactionResult = { duplicate: true };
          return;
        }

        if (eventType === "payment.captured") {
          transactionResult = await confirmCapturedPayment({
            paymentId: payment.id,
            gatewayPayment: authoritativePayment,
            webhookEventId: webhookRecord.id,
            transactionClient: tx,
          });
        } else {
          transactionResult = await recordFailedPayment({
            paymentId: payment.id,
            gatewayPayment: authoritativePayment,
            webhookEventId: webhookRecord.id,
            transactionClient: tx,
            req,
          });
        }

        await tx.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: { status: "PROCESSED", processedAt: now(), lastError: null },
        });
      });

      if (transactionResult?.duplicate) {
        return res.status(200).json({ success: true, message: "Webhook event already being processed" });
      }
      if (transactionResult?.fulfilled) notifyOrder(req, transactionResult.order);
      else if (transactionResult?.order?.status === "PAYMENT_ABANDONED") notifyOrder(req, transactionResult.order);
      return res.status(200).json({
        success: true,
        message: eventType === "payment.captured" ? "Payment webhook processed" : "Payment failure recorded",
        additionalCaptureNeedsReconciliation: transactionResult?.additionalCaptureNeedsReconciliation === true,
        additionalCaptureDetected: transactionResult?.additionalCaptureDetected === true,
      });
    } catch (error) {
      if (webhookRecord?.id) {
        try {
          await prisma.webhookEvent.update({
            where: { id: webhookRecord.id },
            data: { status: "FAILED", lastError: String(error.message || error).slice(0, 1000) },
          });
        } catch (recordError) {
          logger.error("Failed to record webhook processing error:", recordError);
        }
      }
      if (error instanceof PaymentError) {
        // Retryable failures must be retried by Razorpay; permanent payload/signature
        // failures are rejected. Database and gateway failures use 5xx responses.
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("Webhook processing error:", error);
      return res.status(500).json({ success: false, message: "Webhook processing failed" });
    }
  }

  async function getPaymentAttemptsForOrder(req, res) {
    try {
      const numericOrderId = parseOrderId(req.params?.orderId);
      if (!numericOrderId) {
        throw new PaymentError(400, "INVALID_ORDER_ID", "A valid orderId is required");
      }
      const order = await prisma.order.findUnique({
        where: { id: numericOrderId },
        include: orderWithPayments,
      });
      if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Order not found");

      let sawFailure = false;
      let sawUnresolvedPayment = false;
      let reconciledCapturedPayment = false;
      let additionalCaptureNeedsReconciliation = false;
      let additionalCaptureDetected = false;
      const paymentOrdersToReconcile = (order.payments || []).filter((item) =>
        item.gateway === "RAZORPAY" && item.gatewayOrderId &&
        ["PENDING", "PROCESSING", "FAILED", "CANCELLED", "TIMED_OUT"].includes(item.status),
      );
      for (const payment of paymentOrdersToReconcile) {
        try {
          const reconciliation = await reconcilePendingPayment(payment, req);
          if (reconciliation?.fulfilled) {
            reconciledCapturedPayment = true;
          }
          additionalCaptureNeedsReconciliation ||= reconciliation?.additionalCaptureNeedsReconciliation === true;
          additionalCaptureDetected ||= reconciliation?.additionalCaptureDetected === true;
          if (reconciliation?.failed) sawFailure = true;
          if (reconciliation?.unresolved) sawUnresolvedPayment = true;
        } catch (error) {
          if (!(error instanceof PaymentError && error.code === "GATEWAY_UNAVAILABLE")) throw error;
        }
      }
      const latestOrder = await prisma.order.findUnique({
        where: { id: numericOrderId },
        include: orderWithPayments,
      });
      const paymentSummary = getPaymentSummary(latestOrder || order);
      additionalCaptureNeedsReconciliation ||= paymentSummary.additionalCaptureNeedsReconciliation;
      if (reconciledCapturedPayment) {
        return res.status(200).json({
          success: true,
          message: "Payment reconciled",
          additionalCaptureNeedsReconciliation,
          additionalCaptureDetected,
          order: { ...(latestOrder || order), ...paymentSummary },
        });
      }
      return res.status(200).json({
        success: true,
        additionalCaptureNeedsReconciliation,
        additionalCaptureDetected,
        message: sawFailure
          ? "Payment failures reconciled"
          : sawUnresolvedPayment
            ? "Payment outcome is still being confirmed"
            : undefined,
        order: withPaymentSummary(latestOrder || order),
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      logger.error("getPaymentAttemptsForOrder error:", error);
      return res.status(500).json({ success: false, message: "Failed to get payment attempts" });
    }
  }

  return {
    createPaymentOrder,
    verifyRazorpayPayment,
    reconcileCheckoutFailure,
    refundRazorpayPayment,
    reconcileRazorpayRefund,
    handleRazorpayWebhook,
    getPaymentAttemptsForOrder,
    reconcilePendingPayment,
    confirmCapturedPayment,
    recordFailedPayment,
    finalizeAttemptLimit,
  };
}

module.exports = {
  ...createPaymentController(),
  createPaymentController,
  _private: { parseOrderId, secureHexEqual, validateAuthoritativePayment, minorUnits },
};

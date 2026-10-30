const defaultPrisma = require("../config/prisma");
const defaultGateway = require("../services/razorpayService");
const { createPaymentController } = require("../controllers/paymentController");

function createPaymentExpiryJob({
  prisma = defaultPrisma,
  gateway = defaultGateway,
  now = () => new Date(),
  logger = console,
  io = null,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const controller = createPaymentController({ prisma, gateway, now, logger });
  let intervalId = null;

  async function sweepExpiredPayments() {
    const currentTime = now();
    let expiredPayments = [];

    try {
      expiredPayments = await prisma.payment.findMany({
        where: {
          status: { in: ["PENDING", "PROCESSING"] },
          expiresAt: { lt: currentTime },
        },
      });
    } catch (error) {
      logger.error("Failed to query expired payments:", error);
      return { swept: 0, timedOut: 0, fulfilled: 0, errors: [error] };
    }

    if (!expiredPayments.length) {
      return { swept: 0, timedOut: 0, fulfilled: 0, errors: [] };
    }

    logger.info(`Found ${expiredPayments.length} expired payment attempt(s) to reconcile`);
    let timedOutCount = 0;
    let fulfilledCount = 0;
    const errors = [];

    for (const payment of expiredPayments) {
      try {
    
    let reconciled = null;

    if (payment.gatewayOrderId && controller.reconcilePendingPayment) {
      try {
        reconciled = await controller.reconcilePendingPayment(
          payment,
          { app: { get: () => io } }
        );
      } catch (gatewayErr) {
        // A gateway error does not prove that payment failed.
        // Keep the payment unresolved and retry during a later sweep.
        logger.warn(
          `Gateway check failed for expired payment ${payment.id}; leaving it unresolved for retry:`,
          gatewayErr.message || gatewayErr
        );

        errors.push(gatewayErr);
        continue;
      }
    }






        if (reconciled?.fulfilled) {
          logger.info(`Expired payment ${payment.id} for order ${payment.orderId} was captured and fulfilled`);
          fulfilledCount++;
          continue;
        }

        const freshPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (freshPayment && freshPayment.status !== "PENDING" && freshPayment.status !== "PROCESSING") {
          continue;
        }

        const updated = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${payment.orderId})`;
          const current = await tx.payment.findUnique({ where: { id: payment.id } });
          if (!current || !["PENDING", "PROCESSING"].includes(current.status)) return { count: 0 };
          if (current.status === "PENDING") {
            await tx.payment.updateMany({
              where: { id: payment.id, status: "PENDING" },
              data: { status: "PROCESSING" },
            });
          }
          return tx.payment.updateMany({
            where: { id: payment.id, status: "PROCESSING" },
            data: { status: "TIMED_OUT" },
          });
        });

        if (updated.count > 0) {
          timedOutCount++;
          if (controller.finalizeAttemptLimit) {
            const abandoned = await controller.finalizeAttemptLimit(payment.orderId);
            if (abandoned && io && io.emit) {
              io.emit("PAYMENT_ATTEMPTS_EXHAUSTED", {
                orderId: payment.orderId,
                status: "PAYMENT_ABANDONED",
              });
            }
          }
          logger.info(`Payment attempt ${payment.id} for order ${payment.orderId} marked as TIMED_OUT`);
          if (io && io.emit) {
            io.emit("PAYMENT_TIMED_OUT", {
              orderId: payment.orderId,
              paymentId: payment.id,
              reason: "Payment window expired",
            });
          }
        }
      } catch (err) {
        logger.error(`Error processing expired payment ${payment.id}:`, err);
        errors.push(err);
      }
    }

    return {
      swept: expiredPayments.length,
      timedOut: timedOutCount,
      fulfilled: fulfilledCount,
      errors,
    };
  }

  function startPaymentExpiryJob(intervalMs = 5 * 60 * 1000) {
    if (intervalId) return intervalId;
    logger.info(`Starting payment expiry background job (interval: ${intervalMs}ms)`);
    sweepExpiredPayments().catch((err) => logger.error("Initial sweep failed:", err));
    intervalId = setIntervalFn(sweepExpiredPayments, intervalMs);
    if (intervalId && typeof intervalId.unref === "function") {
      intervalId.unref();
    }
    return intervalId;
  }

  function stopPaymentExpiryJob() {
    if (intervalId) {
      clearIntervalFn(intervalId);
      intervalId = null;
      logger.info("Payment expiry background job stopped");
    }
  }

  return {
    sweepExpiredPayments,
    startPaymentExpiryJob,
    stopPaymentExpiryJob,
  };
}

module.exports = {
  ...createPaymentExpiryJob(),
  createPaymentExpiryJob,
};

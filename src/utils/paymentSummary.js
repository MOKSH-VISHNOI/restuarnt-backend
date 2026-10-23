const MAX_PAYMENT_ATTEMPTS = 3;

function getPaymentSummary(order) {
  const paymentOrders = (order?.payments || []).filter((payment) => payment.gateway === "RAZORPAY");
  const attempts = paymentOrders.flatMap((payment) => {
    const gatewayAttempts = Array.isArray(payment.transactions)
      ? payment.transactions.filter((transaction) => transaction.gatewayPaymentId?.startsWith("pay_"))
      : [];
    if (gatewayAttempts.length > 0) {
      return gatewayAttempts.map((transaction) =>
        payment.status === "TIMED_OUT" && ["PENDING", "AUTHORIZED"].includes(transaction.status)
          ? { ...transaction, status: "TIMED_OUT" }
          : transaction);
    }

    // Keep summaries compatible with rows created before PaymentTransaction existed.
    const legacyStatuses = {
      PROCESSING: "PROCESSING",
      SUCCESS: "CAPTURED",
      FAILED: "FAILED",
      CANCELLED: "FAILED",
      TIMED_OUT: "TIMED_OUT",
      REFUNDED: "REFUNDED",
      PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
    };
    if (payment.gatewayPaymentId) {
      return [{ status: legacyStatuses[payment.status] || "PENDING", gatewayPaymentId: payment.gatewayPaymentId }];
    }

    // A persisted payment reservation is an attempt even if Razorpay order
    // creation failed before a gateway order or payment ID could be saved.
    return [{ status: legacyStatuses[payment.status] || "PENDING", gatewayPaymentId: payment.gatewayPaymentId || null }];
  });
  const capturedPaymentIds = new Set(attempts
    .filter((attempt) => attempt.status === "CAPTURED" && attempt.gatewayPaymentId?.startsWith("pay_"))
    .map((attempt) => attempt.gatewayPaymentId));
  for (const payment of paymentOrders) {
    if (payment.status === "SUCCESS" && payment.gatewayPaymentId?.startsWith("pay_")) {
      capturedPaymentIds.add(payment.gatewayPaymentId);
    }
  }
  const terminalStatuses = new Set(["FAILED", "CANCELLED", "TIMED_OUT"]);
  const hasSuccess = paymentOrders.some((payment) => payment.status === "SUCCESS") ||
    attempts.some((attempt) => attempt.status === "CAPTURED");
  const hasProcessing = paymentOrders.some((payment) => payment.status === "PROCESSING") ||
    attempts.some((attempt) => attempt.status === "PROCESSING");
  const hasPending = paymentOrders.some((payment) => payment.status === "PENDING") ||
    attempts.some((attempt) => ["PENDING", "AUTHORIZED"].includes(attempt.status));

  const hasRefunded = paymentOrders.some((payment) => payment.status === "REFUNDED") ||
    attempts.some((attempt) => attempt.status === "REFUNDED");
  const hasPartiallyRefunded = paymentOrders.some((payment) => payment.status === "PARTIALLY_REFUNDED") ||
    attempts.some((attempt) => attempt.status === "PARTIALLY_REFUNDED");

  let paymentState;
  if (order?.status === "PAYMENT_ABANDONED") {
    paymentState = "ATTEMPTS_EXHAUSTED";
  } else if (order?.status !== "PENDING_PAYMENT") {
    if (hasRefunded) {
      paymentState = "REFUNDED";
    } else if (hasPartiallyRefunded) {
      paymentState = "PARTIALLY_REFUNDED";
    } else {
      paymentState = hasSuccess ? "PAID" : "NOT_REQUIRED";
    }
  } else if (hasSuccess) {
    paymentState = "CONFIRMING";
  } else if (
    attempts.length >= MAX_PAYMENT_ATTEMPTS &&
    attempts.every((payment) => terminalStatuses.has(payment.status))
  ) {
    paymentState = "ATTEMPTS_EXHAUSTED";
  } else if (hasProcessing) {
    paymentState = "PROCESSING";
  } else if (hasPending) {
    paymentState = "PENDING";
  } else if (attempts.some((payment) => terminalStatuses.has(payment.status))) {
    paymentState = "RETRY_AVAILABLE";
  } else {
    paymentState = "AWAITING_PAYMENT";
  }

  return {
    paymentState,
    paymentAttemptsUsed: attempts.length,
    paymentAttemptsRemaining: Math.max(0, MAX_PAYMENT_ATTEMPTS - attempts.length),
    maxPaymentAttempts: MAX_PAYMENT_ATTEMPTS,
    additionalCaptureNeedsReconciliation: capturedPaymentIds.size > 1,
  };
}

module.exports = { MAX_PAYMENT_ATTEMPTS, getPaymentSummary };

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const http = require("node:http");
const { createPaymentController } = require("../src/controllers/paymentController");
const { createPaymentExpiryJob } = require("../src/jobs/paymentExpiryJob");
const paymentRoutes = require("../src/routes/paymentRoutes");

const KEY_SECRET = "unit-test-key-secret";
const WEBHOOK_SECRET = "unit-test-webhook-secret";

function clone(value) {
  return structuredClone(value);
}

function statusMatches(current, filter) {
  if (filter === undefined) return true;
  if (typeof filter === "string") return current === filter;
  if (filter.in) return filter.in.includes(current);
  if (filter.not) return current !== filter.not;
  return true;
}

function createHarness({ waterOnly = false, failOrderClaim = false, failGatewayOrderSave = false } = {}) {
  const state = {
    orders: [{
      id: 1,
      status: "PENDING_PAYMENT",
      tokenNumber: null,
      totalAmount: 100,
      items: [{ quantity: 1, menuItem: { name: waterOnly ? "Water Bottle" : "Paneer Sandwich" } }],
    }],
    payments: [],
    paymentTransactions: [],
    paymentRefunds: [],
    webhookEvents: [],
    dailyTokenCounter: [],
  };
  let nextPaymentId = 1;
  let nextWebhookId = 1;
  let transactionQueue = Promise.resolve();
  let shouldFailOrderClaim = failOrderClaim;
  let shouldFailGatewayOrderSave = failGatewayOrderSave;

  const prisma = {
    order: {
      findUnique: async ({ where, include }) => {
        const order = state.orders.find((row) => row.id === where.id);
        if (!order) return null;
        const result = clone(order);
        if (include?.payments) {
          result.payments = state.payments
            .filter((row) => row.orderId === order.id)
            .map((payment) => ({
              ...clone(payment),
              ...(include.payments.include?.transactions
                ? { transactions: state.paymentTransactions.filter((row) => row.paymentId === payment.id).map(clone) }
                : {}),
            }));
        }
        return result;
      },
      updateMany: async ({ where, data }) => {
        if (shouldFailOrderClaim) {
          shouldFailOrderClaim = false;
          throw new Error("simulated database write failure");
        }
        const order = state.orders.find((row) => row.id === where.id &&
          statusMatches(row.status, where.status) &&
          (where.tokenNumber === undefined || row.tokenNumber === where.tokenNumber));
        if (!order) return { count: 0 };
        Object.assign(order, clone(data));
        return { count: 1 };
      },
      update: async ({ where, data, include }) => {
        const order = state.orders.find((row) => row.id === where.id);
        if (!order) throw new Error("Order not found");
        Object.assign(order, clone(data));
        const result = clone(order);
        if (include?.payments) result.payments = state.payments.filter((row) => row.orderId === order.id).map(clone);
        return result;
      },
    },
    payment: {
      findUnique: async ({ where }) => {
        const payment = where.id !== undefined
          ? state.payments.find((row) => row.id === where.id)
          : state.payments.find((row) => row.idempotencyKey === where.idempotencyKey);
        return payment ? clone(payment) : null;
      },
      findFirst: async ({ where, include }) => {
        const payment = state.payments.find((row) => row.gateway === where.gateway && row.gatewayOrderId === where.gatewayOrderId);
        if (!payment) return null;
        const result = clone(payment);
        if (include?.order) {
          const order = state.orders.find((row) => row.id === payment.orderId);
          result.order = order ? clone(order) : null;
        }
        return result;
      },
      findMany: async ({ where = {}, include } = {}) => {
        const results = state.payments.filter((row) => {
          if (where.status && !statusMatches(row.status, where.status)) return false;
          if (where.expiresAt) {
            if (where.expiresAt.lt && !(row.expiresAt && row.expiresAt < where.expiresAt.lt)) return false;
            if (where.expiresAt.gt && !(row.expiresAt && row.expiresAt > where.expiresAt.gt)) return false;
          }
          if (where.orderId && row.orderId !== where.orderId) return false;
          return true;
        });
        return results.map((payment) => {
          const res = clone(payment);
          if (include?.order) {
            const order = state.orders.find((o) => o.id === payment.orderId);
            res.order = order ? clone(order) : null;
          }
          if (include?.transactions) {
            res.transactions = state.paymentTransactions.filter((t) => t.paymentId === payment.id).map(clone);
          }
          return res;
        });
      },
      create: async ({ data }) => {
        if (state.payments.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const maxId = state.payments.reduce((max, p) => Math.max(max, p.id || 0), 0);
        const payment = { id: Math.max(nextPaymentId++, maxId + 1), createdAt: new Date(), ...clone(data) };
        state.payments.push(payment);
        return clone(payment);
      },
      update: async ({ where, data }) => {
        const payment = state.payments.find((row) => row.id === where.id);
        if (!payment) throw new Error("Payment not found");
        if (shouldFailGatewayOrderSave && data.gatewayOrderId) {
          shouldFailGatewayOrderSave = false;
          throw new Error("simulated database write failure");
        }
        Object.assign(payment, clone(data));
        return clone(payment);
      },
      updateMany: async ({ where, data }) => {
        const matches = state.payments.filter((row) =>
          (where.id === undefined || row.id === where.id) &&
          (where.orderId === undefined || row.orderId === where.orderId) &&
          (where.gateway === undefined || row.gateway === where.gateway) &&
          (where.gatewayOrderId === undefined || (where.gatewayOrderId === null ? row.gatewayOrderId == null : row.gatewayOrderId === where.gatewayOrderId)) &&
          statusMatches(row.status, where.status));
        for (const payment of matches) Object.assign(payment, clone(data));
        return { count: matches.length };
      },
    },
    paymentTransaction: {
      findUnique: async ({ where }) => {
        const transaction = state.paymentTransactions.find((row) => row.gatewayPaymentId === where.gatewayPaymentId);
        return transaction ? clone(transaction) : null;
      },
      upsert: async ({ where, create, update }) => {
        let transaction = state.paymentTransactions.find((row) => row.gatewayPaymentId === where.gatewayPaymentId);
        if (transaction) {
          Object.assign(transaction, clone(update));
        } else {
          transaction = { id: state.paymentTransactions.length + 1, createdAt: new Date(), ...clone(create) };
          state.paymentTransactions.push(transaction);
        }
        return clone(transaction);
      },
    },
    paymentRefund: {
      findUnique: async ({ where }) => {
        const refund = state.paymentRefunds.find((row) =>
          where.id !== undefined ? row.id === where.id : row.idempotencyKey === where.idempotencyKey);
        return refund ? clone(refund) : null;
      },
      findMany: async ({ where }) => state.paymentRefunds
        .filter((row) => row.paymentId === where.paymentId && statusMatches(row.status, where.status))
        .map(clone),
      create: async ({ data }) => {
        const refund = { id: state.paymentRefunds.length + 1, ...clone(data) };
        state.paymentRefunds.push(refund);
        return clone(refund);
      },
      update: async ({ where, data }) => {
        const refund = state.paymentRefunds.find((row) => row.id === where.id);
        if (!refund) throw new Error("Refund not found");
        Object.assign(refund, clone(data));
        return clone(refund);
      },
    },
    dailyTokenCounter: {
      upsert: async ({ where, create }) => {
        let counter = state.dailyTokenCounter.find((row) => row.counterDate.getTime() === where.counterDate.getTime());
        if (!counter) {
          counter = { id: state.dailyTokenCounter.length + 1, ...clone(create) };
          state.dailyTokenCounter.push(counter);
        }
        return clone(counter);
      },
      update: async ({ where, data }) => {
        const counter = state.dailyTokenCounter.find((row) => row.counterDate.getTime() === where.counterDate.getTime());
        if (!counter) throw new Error("Daily counter not found");
        counter.lastToken += data.lastToken.increment;
        return clone(counter);
      },
    },
    webhookEvent: {
      create: async ({ data }) => {
        if (state.webhookEvents.some((row) => row.gateway === data.gateway && row.externalEventId === data.externalEventId)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const event = { id: nextWebhookId++, receivedAt: new Date(), processingAttempts: 0, ...clone(data) };
        state.webhookEvents.push(event);
        return clone(event);
      },
      findUnique: async ({ where }) => {
        const composite = where.gateway_externalEventId;
        const event = composite
          ? state.webhookEvents.find((row) => row.gateway === composite.gateway && row.externalEventId === composite.externalEventId)
          : state.webhookEvents.find((row) => row.id === where.id);
        return event ? clone(event) : null;
      },
      updateMany: async ({ where, data }) => {
        const events = state.webhookEvents.filter((row) => row.id === where.id && statusMatches(row.status, where.status));
        for (const event of events) {
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === "object" && value.increment) event[key] = (event[key] || 0) + value.increment;
            else event[key] = clone(value);
          }
        }
        return { count: events.length };
      },
      update: async ({ where, data }) => {
        const event = state.webhookEvents.find((row) => row.id === where.id);
        if (!event) throw new Error("Webhook event not found");
        Object.assign(event, clone(data));
        return clone(event);
      },
    },
    $executeRaw: async () => 1,
  };

  prisma.$transaction = async (work) => {
    const previous = transactionQueue;
    let release;
    transactionQueue = new Promise((resolve) => { release = resolve; });
    await previous;
    const snapshot = clone(state);
    try {
      return await work(prisma);
    } catch (error) {
      state.orders = snapshot.orders;
      state.payments = snapshot.payments;
      state.paymentTransactions = snapshot.paymentTransactions;
      state.paymentRefunds = snapshot.paymentRefunds;
      state.webhookEvents = snapshot.webhookEvents;
      state.dailyTokenCounter = snapshot.dailyTokenCounter;
      throw error;
    } finally {
      release();
    }
  };

  const gateway = {
    createdOrderCount: 0,
    paymentsById: new Map(),
    ordersByReceipt: new Map(),
    createRazorpayOrder: async ({ amount, receipt }) => {
      gateway.createdOrderCount += 1;
      const order = {
        id: `order_created${gateway.createdOrderCount}`,
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt,
        status: "created",
      };
      gateway.ordersByReceipt.set(receipt, order);
      return clone(order);
    },
    findRazorpayOrderByReceipt: async (receipt) => clone(gateway.ordersByReceipt.get(receipt) || null),
    fetchPaymentById: async (id) => {
      if (!gateway.paymentsById.has(id)) throw new Error("Gateway payment not found");
      return clone(gateway.paymentsById.get(id));
    },
    fetchPaymentsForOrder: async (orderId) => [...gateway.paymentsById.values()]
      .filter((payment) => payment.order_id === orderId).map(clone),
    refunds: [],
    refundPayment: async (paymentId, amount, idempotencyKey) => {
      const refund = {
        id: `rfnd_x${gateway.refunds.length + 1}`,
        payment_id: paymentId,
        amount: Math.round(amount * 100),
        status: "processed",
        notes: { idempotencyKey },
      };
      gateway.refunds.push(refund);
      return clone(refund);
    },
  };

  const emitted = [];
  const controller = createPaymentController({
    prisma,
    gateway,
    env: { RAZORPAY_KEY_ID: "test_key", RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET },
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    logger: { error() {}, warn() {} },
  });
  const io = { emit: (...args) => emitted.push(args) };

  return { state, prisma, gateway, controller, emitted, io };
}

function seedPayment(harness, {
  id = 1,
  orderId = 1,
  amount = 100,
  status = "PENDING",
  gatewayOrderId = "order_123abc",
  gatewayPaymentId = null,
  idempotencyKey = "attempt-key-123",
  refundedAmount = 0,
} = {}) {
  const payment = { id, orderId, amount, status, gateway: "RAZORPAY", gatewayOrderId, gatewayPaymentId, idempotencyKey, refundedAmount };
  harness.state.payments.push(payment);
  return payment;
}

function gatewayPayment({
  id = "pay_123abc",
  orderId = "order_123abc",
  amount = 10000,
  currency = "INR",
  status = "captured",
} = {}) {
  return { id, order_id: orderId, amount, currency, status };
}

function signatureForCheckout(orderId, paymentId) {
  return crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

function signWebhook(rawBody) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

async function invoke(handler, harness, { body = {}, params = {}, rawBody, headers = {} } = {}) {
  const req = {
    body: rawBody ?? body,
    params,
    headers,
    app: { get: () => harness.io },
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler(req, res);
  return res;
}

async function verify(harness, paymentId = "pay_123abc", orderId = "order_123abc", signature) {
  return invoke(harness.controller.verifyRazorpayPayment, harness, {
    body: {
      orderId: 1,
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature ?? signatureForCheckout(orderId, paymentId),
    },
  });
}

async function webhook(harness, { event = "payment.captured", payment = gatewayPayment(), eventId = "evt_123abc" } = {}) {
  const rawBody = Buffer.from(JSON.stringify({
    id: eventId,
    event,
    payload: { payment: { entity: payment } },
  }));
  return invoke(harness.controller.handleRazorpayWebhook, harness, {
    rawBody,
    headers: { "x-razorpay-signature": signWebhook(rawBody) },
  });
}

test("captured checkout payment is validated and releases exactly one order token", async () => {
  const h = createHarness();
  const payment = seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await verify(h);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.order.status, "PLACED");
  assert.equal(response.payload.order.tokenNumber, 101);
  assert.equal(response.payload.payment.status, "SUCCESS");
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.state.payments.find((row) => row.id === payment.id).gatewayPaymentId, "pay_123abc");
  assert.deepEqual(h.emitted.map(([event]) => event), ["ORDER_STATUS_UPDATED", "NEW_ORDER"]);
});

test("checkout verification resolves the attempt from Razorpay's authoritative order ID", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_123abc", idempotencyKey: "attempt-key-first" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_456def", idempotencyKey: "attempt-key-second" });
  const captured = gatewayPayment({
    id: "pay_456def",
    orderId: "order_456def",
    status: "captured",
  });
  h.gateway.paymentsById.set(captured.id, captured);

  // Simulate a stale Checkout order ID while retaining Razorpay's valid
  // signature for the payment's actual order.
  const response = await verify(
    h,
    captured.id,
    "order_123abc",
    signatureForCheckout("order_456def", captured.id),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.payment.id, 2);
  assert.equal(response.payload.order.status, "PLACED");
  assert.equal(response.payload.order.tokenNumber, 101);
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.payments[1].status, "SUCCESS");
});

test("invalid checkout signature leaves payment and order untouched", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await verify(h, "pay_123abc", "order_123abc", "0".repeat(64));

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "INVALID_PAYMENT_SIGNATURE");
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  assert.equal(h.state.dailyTokenCounter.length, 0);
});

test("authorized and mismatched payments cannot release an order", async (t) => {
  await t.test("authorized", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ status: "authorized" }));
    const response = await verify(h);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.code, "PAYMENT_NOT_CAPTURED");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
    assert.equal(h.state.dailyTokenCounter.length, 0);
  });

  await t.test("wrong amount", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ amount: 9999 }));
    const response = await verify(h);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.code, "PAYMENT_AMOUNT_MISMATCH");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  });

  await t.test("wrong currency", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ currency: "USD" }));
    const response = await verify(h);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.code, "PAYMENT_CURRENCY_MISMATCH");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  });
});

test("failed payment webhook records failure and a new idempotency key starts a fresh attempt", async () => {
  const h = createHarness();
  seedPayment(h);
  const failed = gatewayPayment({ id: "pay_failed1", status: "failed" });
  h.gateway.paymentsById.set(failed.id, failed);

  const response = await webhook(h, { event: "payment.failed", payment: failed, eventId: "evt_failed1" });
  assert.equal(response.statusCode, 200);
  assert.equal(h.state.payments[0].status, "FAILED");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");

  const sameKeyRetry = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-123" },
  });
  assert.equal(sameKeyRetry.statusCode, 409);
  assert.equal(sameKeyRetry.payload.code, "PAYMENT_ATTEMPT_FAILED");

  const retry = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-retry" },
  });
  assert.equal(retry.statusCode, 201);
  assert.equal(h.state.payments.length, 2);
  assert.equal(h.gateway.createdOrderCount, 1);
});

test("payment recovery records an authoritative failed checkout and exposes a retryable state", async () => {
  const h = createHarness();
  seedPayment(h);
  const failed = gatewayPayment({ id: "pay_failed2", status: "failed" });
  h.gateway.paymentsById.set(failed.id, failed);

  const response = await invoke(h.controller.getPaymentAttemptsForOrder, h, {
    params: { orderId: "1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(h.state.payments[0].status, "FAILED");
  assert.equal(response.payload.order.status, "PENDING_PAYMENT");
  assert.equal(response.payload.order.paymentState, "RETRY_AVAILABLE");
  assert.equal(response.payload.order.paymentAttemptsUsed, 1);
});

test("checkout failure reconciles the exact payment ID even when Razorpay's order list is delayed", async () => {
  const h = createHarness();
  seedPayment(h);
  const failed = gatewayPayment({ id: "pay_failed3", status: "failed" });
  h.gateway.paymentsById.set(failed.id, failed);
  h.gateway.fetchPaymentsForOrder = async () => {
    throw new Error("simulate delayed order payment listing");
  };

  const response = await invoke(h.controller.reconcileCheckoutFailure, h, {
    body: {
      orderId: 1,
      razorpay_order_id: failed.order_id,
      razorpay_payment_id: failed.id,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.outcome, "FAILED");
  assert.equal(response.payload.payment.status, "FAILED");
  assert.equal(response.payload.order.paymentState, "RETRY_AVAILABLE");
  assert.equal(response.payload.order.paymentAttemptsUsed, 1);

  const retry = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-after-failure" },
  });
  assert.equal(retry.statusCode, 201);
  assert.equal(h.state.payments.length, 2);
  assert.equal(h.gateway.createdOrderCount, 1);
});

test("checkout failure callback cannot mark an authorized payment failed", async () => {
  const h = createHarness();
  seedPayment(h);
  const authorized = gatewayPayment({ id: "pay_authorized2", status: "authorized" });
  h.gateway.paymentsById.set(authorized.id, authorized);

  const response = await invoke(h.controller.reconcileCheckoutFailure, h, {
    body: {
      orderId: 1,
      razorpay_order_id: authorized.order_id,
      razorpay_payment_id: authorized.id,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.outcome, "UNRESOLVED");
  assert.equal(response.payload.payment.status, "PENDING");
  assert.equal(response.payload.order.paymentState, "PENDING");
});

test("a late failure callback maps by Razorpay's payment order to the correct attempt on the same restaurant order", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_123abc", idempotencyKey: "attempt-key-first" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_456def", idempotencyKey: "attempt-key-second" });
  const failedSecondAttempt = gatewayPayment({
    id: "pay_456def",
    orderId: "order_456def",
    status: "failed",
  });
  h.gateway.paymentsById.set(failedSecondAttempt.id, failedSecondAttempt);

  const response = await invoke(h.controller.reconcileCheckoutFailure, h, {
    body: {
      orderId: 1,
      // Simulate a delayed callback carrying the previous attempt's order ID.
      razorpay_order_id: "order_123abc",
      razorpay_payment_id: failedSecondAttempt.id,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.outcome, "FAILED");
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.payments[1].status, "FAILED");
  assert.equal(response.payload.order.paymentAttemptsUsed, 2);
});

test("checkout failure callback safely fulfills if Razorpay already captured the payment", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment({ id: "pay_capturedaftercallback", status: "captured" });
  h.gateway.paymentsById.set(captured.id, captured);

  const response = await invoke(h.controller.reconcileCheckoutFailure, h, {
    body: {
      orderId: 1,
      razorpay_order_id: captured.order_id,
      razorpay_payment_id: captured.id,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.outcome, "CAPTURED");
  assert.equal(response.payload.order.status, "PLACED");
  assert.equal(response.payload.order.paymentState, "PAID");
  assert.equal(response.payload.order.tokenNumber, 101);
});

test("checkout reconciliation rejects payment details that do not match the reserved amount", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_badamount", gatewayPayment({
    id: "pay_badamount",
    amount: 12000,
    status: "failed",
  }));

  const response = await invoke(h.controller.reconcileCheckoutFailure, h, {
    body: {
      orderId: 1,
      razorpay_order_id: "order_123abc",
      razorpay_payment_id: "pay_badamount",
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "PAYMENT_AMOUNT_MISMATCH");
  assert.equal(h.state.payments[0].status, "PENDING");
});

test("three definitively failed attempts exhaust retries and block a fourth", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, status: "FAILED", gatewayOrderId: "order_attempt1", idempotencyKey: "attempt-key-one" });
  seedPayment(h, { id: 2, status: "FAILED", gatewayOrderId: "order_attempt2", idempotencyKey: "attempt-key-two" });
  seedPayment(h, { id: 3, status: "FAILED", gatewayOrderId: "order_attempt3", idempotencyKey: "attempt-key-three" });

  const summary = await invoke(h.controller.getPaymentAttemptsForOrder, h, {
    params: { orderId: "1" },
  });
  const fourthAttempt = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-four" },
  });

  assert.equal(summary.statusCode, 200);
  assert.equal(summary.payload.order.status, "PENDING_PAYMENT");
  assert.equal(summary.payload.order.paymentState, "ATTEMPTS_EXHAUSTED");
  assert.equal(summary.payload.order.paymentAttemptsUsed, 3);
  assert.equal(fourthAttempt.statusCode, 429);
  assert.equal(fourthAttempt.payload.code, "PAYMENT_ATTEMPT_LIMIT");
  assert.equal(h.state.payments.length, 3);
  assert.equal(h.gateway.createdOrderCount, 0);
});

test("an authorized but uncaptured payment remains unresolved and blocks a new attempt", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_authorized1", gatewayPayment({
    id: "pay_authorized1",
    status: "authorized",
  }));

  const response = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-retry" },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.code, "PAYMENT_OUTCOME_UNRESOLVED");
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  assert.equal(h.gateway.createdOrderCount, 0);
});

test("a later authoritative capture still confirms an attempt previously marked failed", async () => {
  const h = createHarness();
  seedPayment(h, { status: "FAILED" });
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await verify(h);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.payment.status, "SUCCESS");
  assert.equal(response.payload.order.status, "PLACED");
  assert.equal(response.payload.order.tokenNumber, 101);
});

test("a definitive Razorpay setup rejection permits a fresh attempt", async () => {
  const h = createHarness();
  const createOrder = h.gateway.createRazorpayOrder;
  let rejectFirst = true;
  h.gateway.createRazorpayOrder = async (input) => {
    if (rejectFirst) {
      rejectFirst = false;
      const error = new Error("Razorpay rejected the request");
      error.statusCode = 400;
      throw error;
    }
    return createOrder(input);
  };

  const first = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-first" },
  });
  assert.equal(first.statusCode, 502);
  assert.equal(first.payload.code, "PAYMENT_ATTEMPT_FAILED");
  assert.equal(h.state.payments[0].status, "FAILED");

  const retry = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-retry" },
  });
  assert.equal(retry.statusCode, 201);
  assert.equal(h.state.payments.length, 2);
  assert.equal(h.state.payments[1].status, "PROCESSING");
  assert.ok(h.state.payments[1].expiresAt instanceof Date);
});

test("duplicate captured webhook is idempotent", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const first = await webhook(h, { payment: captured });
  const second = await webhook(h, { payment: captured });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.state.webhookEvents.length, 1);
  assert.equal(h.state.webhookEvents[0].status, "PROCESSED");
  assert.deepEqual(h.emitted.map(([event]) => event), ["ORDER_STATUS_UPDATED", "NEW_ORDER"]);
});

test("concurrent checkout verification and webhook delivery issue one token", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const [verification, webhookResponse] = await Promise.all([
    verify(h),
    webhook(h, { payment: captured }),
  ]);

  assert.equal(verification.statusCode, 200);
  assert.equal(webhookResponse.statusCode, 200);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("a failed database transaction can be retried through the same webhook event", async () => {
  const h = createHarness({ failOrderClaim: true });
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const first = await webhook(h, { payment: captured });
  assert.equal(first.statusCode, 500);
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  assert.equal(h.state.webhookEvents[0].status, "FAILED");

  const retry = await webhook(h, { payment: captured });
  assert.equal(retry.statusCode, 200);
  assert.equal(h.state.webhookEvents[0].status, "PROCESSED");
  assert.equal(h.state.orders[0].tokenNumber, 101);
});

test("a previously interrupted PROCESSING webhook can be reclaimed", async () => {
  const h = createHarness();
  seedPayment(h);
  h.state.webhookEvents.push({
    id: 7,
    gateway: "RAZORPAY",
    eventType: "payment.captured",
    externalEventId: "evt_123abc",
    gatewayPaymentId: "pay_123abc",
    gatewayOrderId: "order_123abc",
    status: "PROCESSING",
    processingAttempts: 1,
  });
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const response = await webhook(h, { payment: captured });

  assert.equal(response.statusCode, 200);
  assert.equal(h.state.webhookEvents[0].status, "PROCESSED");
  assert.equal(h.state.webhookEvents[0].processingAttempts, 2);
  assert.equal(h.state.orders[0].tokenNumber, 101);
});

test("verification database failure rolls back payment and token changes", async () => {
  const h = createHarness({ failOrderClaim: true });
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await verify(h);

  assert.equal(response.statusCode, 500);
  assert.equal(h.state.payments[0].status, "PENDING");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  assert.equal(h.state.dailyTokenCounter.length, 0);
});

test("checkout payment cannot release an order unless its authoritative Razorpay order is attached to it", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ orderId: "order_someoneelse" }));

  const response = await verify(h);

  assert.equal(response.statusCode, 404);
  assert.equal(response.payload.code, "PAYMENT_ATTEMPT_NOT_FOUND");
  assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
});

test("water-only orders follow the same captured-payment rule and notify the pickup display", async () => {
  const h = createHarness({ waterOnly: true });
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await verify(h);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.order.status, "READY");
  assert.equal(response.payload.order.readyAt.toISOString(), "2026-10-15T10:00:00.000Z");
  assert.deepEqual(h.emitted.map(([event]) => event), ["ORDER_STATUS_UPDATED", "ORDER_READY", "DISPLAY_REFRESH"]);
});

test("two separately captured payment attempts cannot assign two tokens to one order", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_123abc", idempotencyKey: "attempt-key-one" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_456def", idempotencyKey: "attempt-key-two" });
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());
  h.gateway.paymentsById.set("pay_456def", gatewayPayment({ id: "pay_456def", orderId: "order_456def" }));

  const [first, second] = await Promise.all([
    verify(h, "pay_123abc", "order_123abc"),
    verify(h, "pay_456def", "order_456def"),
  ]);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.state.payments.filter((row) => row.status === "SUCCESS").length, 2);
  assert.deepEqual(
    h.state.paymentTransactions.map(({ paymentId, gatewayPaymentId }) => ({ paymentId, gatewayPaymentId }))
      .sort((a, b) => a.paymentId - b.paymentId),
    [
      { paymentId: 1, gatewayPaymentId: "pay_123abc" },
      { paymentId: 2, gatewayPaymentId: "pay_456def" },
    ],
  );
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("concurrent payment setup reserves only one unresolved attempt", async () => {
  const h = createHarness();
  let releaseGateway;
  const gatewayGate = new Promise((resolve) => { releaseGateway = resolve; });
  h.gateway.createRazorpayOrder = async ({ amount, receipt }) => {
    h.gateway.createdOrderCount += 1;
    await gatewayGate;
    const order = { id: "order_created1", amount: Math.round(amount * 100), currency: "INR", receipt, status: "created" };
    h.gateway.ordersByReceipt.set(receipt, order);
    return order;
  };

  const firstPromise = invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-first" },
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-second" },
  });
  releaseGateway();
  const first = await firstPromise;

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 409);
  assert.equal(second.payload.code, "PAYMENT_ATTEMPT_UNRESOLVED");
  assert.equal(h.state.payments.length, 1);
  assert.equal(h.gateway.createdOrderCount, 1);
});

test("an unresolved payment with a saved Razorpay order is returned for a safe retry", async () => {
  const h = createHarness();
  seedPayment(h);

  const response = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-123" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.razorpayOrder.id, "order_123abc");
  assert.equal(h.gateway.createdOrderCount, 0);
});

test("gateway order persistence failure blocks duplicate external order creation", async () => {
  const h = createHarness({ failGatewayOrderSave: true });
  const first = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-first" },
  });
  const retry = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-first" },
  });

  assert.equal(first.statusCode, 502);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.payload.message, "Recovered existing payment attempt");
  assert.equal(h.state.payments.length, 1);
  assert.equal(h.state.payments[0].gatewayOrderId, "order_created1");
  assert.equal(h.gateway.createdOrderCount, 1);
});

test("payment attempt recovery reconciles captured payments and emits fulfillment events", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const response = await invoke(h.controller.getPaymentAttemptsForOrder, h, { params: { orderId: "1" } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.order.status, "PLACED");
  assert.equal(response.payload.order.tokenNumber, 101);
  assert.deepEqual(h.emitted.map(([event]) => event), ["ORDER_STATUS_UPDATED", "NEW_ORDER"]);
});

test("invalid webhook signatures are rejected before recording or processing", async () => {
  const h = createHarness();
  seedPayment(h);
  const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));

  const response = await invoke(h.controller.handleRazorpayWebhook, h, {
    rawBody,
    headers: { "x-razorpay-signature": "f".repeat(64) },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "INVALID_WEBHOOK_SIGNATURE");
  assert.equal(h.state.webhookEvents.length, 0);
});

test("PROCESSING payment status yields PROCESSING paymentState", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, status: "PROCESSING", gatewayOrderId: "order_proc1" });

  const response = await invoke(h.controller.getPaymentAttemptsForOrder, h, { params: { orderId: "1" } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.order.paymentState, "PROCESSING");
  assert.equal(response.payload.order.paymentAttemptsUsed, 1);
  assert.equal(response.payload.order.paymentAttemptsRemaining, 2);
});

test("TIMED_OUT status allows retry if attempts < 3 and exhausts when reaching 3", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, status: "TIMED_OUT", gatewayOrderId: "order_to1", idempotencyKey: "attempt-to-1" });

  const firstSummary = await invoke(h.controller.getPaymentAttemptsForOrder, h, { params: { orderId: "1" } });
  assert.equal(firstSummary.statusCode, 200);
  assert.equal(firstSummary.payload.order.paymentState, "RETRY_AVAILABLE");
  assert.equal(firstSummary.payload.order.paymentAttemptsUsed, 1);

  seedPayment(h, { id: 2, status: "TIMED_OUT", gatewayOrderId: "order_to2", idempotencyKey: "attempt-to-2" });
  seedPayment(h, { id: 3, status: "TIMED_OUT", gatewayOrderId: "order_to3", idempotencyKey: "attempt-to-3" });

  const finalSummary = await invoke(h.controller.getPaymentAttemptsForOrder, h, { params: { orderId: "1" } });
  assert.equal(finalSummary.statusCode, 200);
  assert.equal(finalSummary.payload.order.paymentState, "ATTEMPTS_EXHAUSTED");
  assert.equal(finalSummary.payload.order.paymentAttemptsUsed, 3);
  assert.equal(finalSummary.payload.order.paymentAttemptsRemaining, 0);
});

test("new payment attempt transitions to PROCESSING after Razorpay order creation and sets 15m expiresAt", async () => {
  const h = createHarness();
  const res = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-proc-test" },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.payment.status, "PROCESSING");
  assert.equal(h.state.payments[0].status, "PROCESSING");
  assert.ok(h.state.payments[0].expiresAt instanceof Date);

  // Expiry should be 15 minutes in the future (10:15:00 vs 10:00:00)
  const diffMinutes = (h.state.payments[0].expiresAt.getTime() - new Date("2026-10-15T10:00:00.000Z").getTime()) / 60000;
  assert.equal(diffMinutes, 15);
});

test("PROCESSING attempt blocks initiating an overlapping attempt (Rule 4)", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, status: "PROCESSING", gatewayOrderId: "order_proc_active", idempotencyKey: "attempt-key-p1" });

  const secondAttempt = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-p2" },
  });

  assert.equal(secondAttempt.statusCode, 200);
  assert.equal(secondAttempt.payload.message, "Existing payment attempt returned");
  assert.equal(secondAttempt.payload.payment.id, 1);
  assert.equal(secondAttempt.payload.razorpayOrder.id, "order_proc_active");
  assert.equal(h.state.payments.length, 1);
  assert.equal(h.gateway.createdOrderCount, 0);
});

test("TIMED_OUT attempt allows initiating a fresh attempt with a new idempotency key", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, status: "TIMED_OUT", gatewayOrderId: "order_to_done", idempotencyKey: "attempt-key-to" });

  const freshAttempt = await invoke(h.controller.createPaymentOrder, h, {
    body: { orderId: 1, idempotencyKey: "attempt-key-fresh" },
  });

  assert.equal(freshAttempt.statusCode, 201);
  assert.equal(h.state.payments.length, 2);
  assert.equal(h.state.payments[1].status, "PROCESSING");
  assert.equal(h.gateway.createdOrderCount, 1);
});

test("expired attempt with no gateway response is marked TIMED_OUT (Rule 11)", async () => {
  const h = createHarness();
  const past = new Date("2026-10-15T09:40:00.000Z"); // 20m before test time 10:00
  const payment = seedPayment(h, { id: 1, status: "PENDING", gatewayOrderId: null });
  payment.expiresAt = past;

  const job = createPaymentExpiryJob({
    prisma: h.prisma,
    gateway: h.gateway,
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
    io: h.io,
  });

  const result = await job.sweepExpiredPayments();

  assert.equal(result.swept, 1);
  assert.equal(result.timedOut, 1);
  assert.equal(h.state.payments[0].status, "TIMED_OUT");
  assert.deepEqual(h.emitted.map(([evt]) => evt), ["PAYMENT_TIMED_OUT"]);
});

test("expiry scheduler starts once at five minutes and can be stopped", async () => {
  const h = createHarness();
  let scheduled = null;
  let cleared = null;
  const job = createPaymentExpiryJob({
    prisma: h.prisma,
    gateway: h.gateway,
    logger: { info() {}, warn() {}, error() {} },
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { callback, intervalMs, unref() {} };
      return scheduled;
    },
    clearIntervalFn: (interval) => { cleared = interval; },
  });

  const firstInterval = job.startPaymentExpiryJob();
  const secondInterval = job.startPaymentExpiryJob();
  assert.equal(firstInterval, secondInterval);
  assert.equal(scheduled.intervalMs, 5 * 60 * 1000);
  job.stopPaymentExpiryJob();
  assert.equal(cleared, firstInterval);
  job.stopPaymentExpiryJob();
  await new Promise((resolve) => setImmediate(resolve));
});

test("expired attempt that was actually captured at Razorpay is fulfilled and releases the order", async () => {
  const h = createHarness();
  const past = new Date("2026-10-15T09:40:00.000Z");
  const payment = seedPayment(h, { id: 1, status: "PROCESSING", gatewayOrderId: "order_exp2" });
  payment.expiresAt = past;

  const capturedPayment = gatewayPayment({
    id: "pay_exp2",
    orderId: "order_exp2",
    status: "captured",
  });
  h.gateway.paymentsById.set(capturedPayment.id, capturedPayment);

  const job = createPaymentExpiryJob({
    prisma: h.prisma,
    gateway: h.gateway,
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
    io: h.io,
  });

  const result = await job.sweepExpiredPayments();

  assert.equal(result.swept, 1);
  assert.equal(result.fulfilled, 1);
  assert.equal(result.timedOut, 0);
  assert.equal(h.state.payments[0].status, "SUCCESS");
  assert.equal(h.state.orders[0].status, "PLACED");
  assert.equal(h.state.orders[0].tokenNumber, 101);
});

test("non-expired attempt is not swept by the expiry job", async () => {
  const h = createHarness();
  const future = new Date("2026-10-15T10:10:00.000Z"); // 10m in the future
  const payment = seedPayment(h, { id: 1, status: "PROCESSING", gatewayOrderId: "order_future" });
  payment.expiresAt = future;

  const job = createPaymentExpiryJob({
    prisma: h.prisma,
    gateway: h.gateway,
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });

  const result = await job.sweepExpiredPayments();

  assert.equal(result.swept, 0);
  assert.equal(result.timedOut, 0);
  assert.equal(h.state.payments[0].status, "PROCESSING");
});

test("gateway errors during expiry sweep are handled gracefully without aborting other sweeps", async () => {
  const h = createHarness();
  const past = new Date("2026-10-15T09:40:00.000Z");
  const p1 = seedPayment(h, { id: 1, status: "PROCESSING", gatewayOrderId: "order_err" });
  p1.expiresAt = past;
  const p2 = seedPayment(h, { id: 2, status: "PENDING", gatewayOrderId: null, idempotencyKey: "key-orphan" });
  p2.expiresAt = past;

  h.gateway.fetchPaymentsForOrder = async () => {
    throw new Error("Razorpay rate limited");
  };

  const job = createPaymentExpiryJob({
    prisma: h.prisma,
    gateway: h.gateway,
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });

  const result = await job.sweepExpiredPayments();

  assert.equal(result.swept, 2);
  assert.equal(result.timedOut, 2);
  assert.equal(h.state.payments[0].status, "TIMED_OUT");
  assert.equal(h.state.payments[1].status, "TIMED_OUT");
});

test("full refund marks payment REFUNDED and creates audit transaction (Rule 16)", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayOrderId: "order_full_rfnd",
    gatewayPaymentId: "pay_full_rfnd",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, idempotencyKey: "refund-full-key-01" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.refund.amount, 100);
  assert.equal(response.payload.payment.status, "REFUNDED");
  assert.equal(response.payload.payment.refundedAmount, 100);
  assert.equal(response.payload.order.paymentState, "REFUNDED");
  assert.equal(h.gateway.refunds.length, 1);
  assert.equal(h.state.paymentRefunds.length, 1);
  assert.equal(h.state.paymentRefunds[0].status, "SUCCESS");
  assert.deepEqual(h.emitted.map(([evt]) => evt), ["ORDER_REFUNDED"]);
});

test("partial refund marks payment PARTIALLY_REFUNDED and updates refundedAmount", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayOrderId: "order_part_rfnd",
    gatewayPaymentId: "pay_part_rfnd",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, amount: 40, idempotencyKey: "refund-part-key-01" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.refund.amount, 40);
  assert.equal(response.payload.payment.status, "PARTIALLY_REFUNDED");
  assert.equal(response.payload.payment.refundedAmount, 40);
  assert.equal(response.payload.order.paymentState, "PARTIALLY_REFUNDED");
  assert.equal(h.state.paymentRefunds.length, 1);
  assert.equal(h.state.paymentRefunds[0].status, "SUCCESS");
});

test("second partial refund up to full amount marks payment REFUNDED", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "PARTIALLY_REFUNDED",
    amount: 100,
    refundedAmount: 40,
    gatewayOrderId: "order_part2_rfnd",
    gatewayPaymentId: "pay_part2_rfnd",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, amount: 60, idempotencyKey: "refund-part-key-02" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.refund.amount, 60);
  assert.equal(response.payload.payment.status, "REFUNDED");
  assert.equal(response.payload.payment.refundedAmount, 100);
  assert.equal(response.payload.order.paymentState, "REFUNDED");
});

test("refund amount exceeding remaining refundable amount is rejected", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "PARTIALLY_REFUNDED",
    amount: 100,
    refundedAmount: 70,
    gatewayOrderId: "order_over_rfnd",
    gatewayPaymentId: "pay_over_rfnd",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, amount: 40, idempotencyKey: "refund-over-key-01" }, // Only 30 remaining
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "REFUND_EXCEEDS_PAYMENT");
  assert.equal(h.gateway.refunds.length, 0);
});

test("refund on order without successful payment is rejected with REFUND_NOT_ELIGIBLE", async () => {
  const h = createHarness();
  seedPayment(h, {
    id: 1,
    status: "PENDING",
    amount: 100,
    gatewayOrderId: "order_pending",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, idempotencyKey: "refund-ineligible-key-01" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "REFUND_NOT_ELIGIBLE");
  assert.equal(h.gateway.refunds.length, 0);
});

test("refund on order that is already fully refunded is rejected", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "REFUNDED",
    amount: 100,
    refundedAmount: 100,
    gatewayOrderId: "order_done_rfnd",
    gatewayPaymentId: "pay_done_rfnd",
  });

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, idempotencyKey: "refund-already-key-01" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "REFUND_NOT_ELIGIBLE");
});

test("repeating a completed refund with the same idempotency key does not refund twice", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayPaymentId: "pay_refundrepeat",
  });
  const request = { body: { orderId: 1, amount: 25, idempotencyKey: "refund-repeat-key-01" } };

  const first = await invoke(h.controller.refundRazorpayPayment, h, request);
  const replay = await invoke(h.controller.refundRazorpayPayment, h, request);

  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 200);
  assert.equal(h.gateway.refunds.length, 1);
  assert.equal(h.state.payments[0].refundedAmount, 25);
  assert.equal(h.state.paymentRefunds.length, 1);
});

test("uncertain refund outcome is reserved and can be reconciled without a duplicate gateway refund", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayPaymentId: "pay_refundreconcile",
  });
  const gatewayRefund = {
    id: "rfnd_reconcile01",
    payment_id: "pay_refundreconcile",
    amount: 4000,
    status: "pending",
  };
  h.gateway.refundPayment = async () => {
    h.gateway.refunds.push(clone(gatewayRefund));
    throw Object.assign(new Error("response timed out"), { code: "ETIMEDOUT" });
  };

  const request = { body: { orderId: 1, amount: 40, idempotencyKey: "refund-reconcile-key-01" } };
  const initial = await invoke(h.controller.refundRazorpayPayment, h, request);
  assert.equal(initial.statusCode, 502);
  assert.equal(initial.payload.code, "REFUND_OUTCOME_UNRESOLVED");
  assert.equal(h.state.paymentRefunds[0].status, "PENDING");
  assert.equal(h.state.payments[0].refundedAmount, 0);

  h.gateway.findRefundByIdempotencyKey = async () => clone(gatewayRefund);
  h.gateway.fetchRefundById = async () => ({ ...clone(gatewayRefund), status: "processed" });
  const reconciled = await invoke(h.controller.reconcileRazorpayRefund, h, request);

  assert.equal(reconciled.statusCode, 200);
  assert.equal(reconciled.payload.outcome, "SUCCESS");
  assert.equal(reconciled.payload.payment.refundedAmount, 40);
  assert.equal(reconciled.payload.payment.status, "PARTIALLY_REFUNDED");
  assert.equal(h.state.paymentRefunds[0].status, "SUCCESS");
  assert.equal(h.gateway.refunds.length, 1);
});

test("concurrent partial refunds cannot reserve more than the remaining balance", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayPaymentId: "pay_refundconcurrent",
  });

  const [first, second] = await Promise.all([
    invoke(h.controller.refundRazorpayPayment, h, {
      body: { orderId: 1, amount: 70, idempotencyKey: "refund-concurrent-key-1" },
    }),
    invoke(h.controller.refundRazorpayPayment, h, {
      body: { orderId: 1, amount: 70, idempotencyKey: "refund-concurrent-key-2" },
    }),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 400]);
  assert.equal(h.gateway.refunds.length, 1);
  assert.equal(h.state.payments[0].refundedAmount, 70);
});

test("refund HTTP route rejects missing or invalid authorization and only then reaches the controller", async () => {
  const previousKey = process.env.PAYMENT_REFUND_API_KEY;
  delete process.env.PAYMENT_REFUND_API_KEY;
  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const unconfigured = await fetch(`${baseUrl}/api/payments/razorpay/refund`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    assert.equal(unconfigured.status, 503);

    process.env.PAYMENT_REFUND_API_KEY = "test-refund-route-secret";
    const unauthorized = await fetch(`${baseUrl}/api/payments/razorpay/refund`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    assert.equal(unauthorized.status, 401);

    const invalidKey = await fetch(`${baseUrl}/api/payments/razorpay/refund`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment-refund-key": "wrong-secret" },
      body: JSON.stringify({}),
    });
    assert.equal(invalidKey.status, 401);

    const authorized = await fetch(`${baseUrl}/api/payments/razorpay/refund`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment-refund-key": "test-refund-route-secret" },
      body: JSON.stringify({}),
    });
    const response = await authorized.json();
    assert.equal(authorized.status, 400);
    assert.equal(response.code, "INVALID_ORDER_ID");
  } finally {
    if (previousKey === undefined) delete process.env.PAYMENT_REFUND_API_KEY;
    else process.env.PAYMENT_REFUND_API_KEY = previousKey;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP integration: payment attempt moves through checkout to captured order", async () => {
  const h = createHarness();
  const app = express();
  app.use(express.json());
  app.set("io", h.io);
  app.post("/api/payments/razorpay/order", h.controller.createPaymentOrder);
  app.post("/api/payments/razorpay/verify", h.controller.verifyRazorpayPayment);
  app.get("/api/payments/order/:orderId/attempts", h.controller.getPaymentAttemptsForOrder);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const startResponse = await fetch(`${baseUrl}/api/payments/razorpay/order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: 1, idempotencyKey: "http-flow-attempt-001" }),
    });
    const started = await startResponse.json();
    assert.equal(startResponse.status, 201);
    assert.equal(started.payment.status, "PROCESSING");
    assert.ok(started.payment.expiresAt);
    assert.equal(h.state.payments.length, 1);

    const capturedPayment = gatewayPayment({
      id: "pay_httpflow001",
      orderId: started.razorpayOrder.id,
      amount: started.razorpayOrder.amount,
    });
    h.gateway.paymentsById.set(capturedPayment.id, capturedPayment);
    const verifyResponse = await fetch(`${baseUrl}/api/payments/razorpay/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: 1,
        razorpay_payment_id: capturedPayment.id,
        razorpay_order_id: started.razorpayOrder.id,
        razorpay_signature: signatureForCheckout(started.razorpayOrder.id, capturedPayment.id),
      }),
    });
    const verified = await verifyResponse.json();
    assert.equal(verifyResponse.status, 200);
    assert.equal(verified.payment.status, "SUCCESS");
    assert.equal(verified.order.status, "PLACED");
    assert.equal(verified.order.tokenNumber, 101);

    const attemptsResponse = await fetch(`${baseUrl}/api/payments/order/1/attempts`);
    const attempts = await attemptsResponse.json();
    assert.equal(attemptsResponse.status, 200);
    assert.equal(attempts.order.paymentState, "PAID");
    assert.equal(attempts.order.paymentAttemptsUsed, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("five repeated checkout verifications keep one confirmation, token, transaction and kitchen release", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());

  const responses = await Promise.all(Array.from({ length: 5 }, () => verify(h)));

  assert.ok(responses.every((response) => response.statusCode === 200));
  assert.equal(h.state.orders[0].status, "PLACED");
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.state.paymentTransactions.length, 1);
  assert.equal(h.state.paymentTransactions[0].gatewayPaymentId, "pay_123abc");
  assert.ok(responses.every((response) => response.payload.additionalCaptureNeedsReconciliation === false));
  assert.ok(responses.every((response) => response.payload.additionalCaptureDetected === false));
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("checkout verification rejects pending, failed, unknown and unattached gateway payments", async (t) => {
  await t.test("pending remains unreleased", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ status: "pending" }));
    const response = await verify(h);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.code, "PAYMENT_NOT_CAPTURED");
    assert.equal(h.state.payments[0].status, "PENDING");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
    assert.equal(h.state.orders[0].tokenNumber, null);
  });

  await t.test("failed status overrides frontend success claim", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ status: "failed" }));
    const response = await verify(h);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.code, "PAYMENT_FAILED");
    assert.equal(h.state.payments[0].status, "FAILED");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
    assert.equal(h.state.dailyTokenCounter.length, 0);
  });

  await t.test("unknown payment reference is not confirmed", async () => {
    const h = createHarness();
    seedPayment(h);
    const response = await verify(h, "pay_unknown1");
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.code, "GATEWAY_UNAVAILABLE");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
    assert.equal(h.state.dailyTokenCounter.length, 0);
  });

  await t.test("wrong Razorpay order is not attached to the restaurant order", async () => {
    const h = createHarness();
    seedPayment(h);
    h.gateway.paymentsById.set("pay_123abc", gatewayPayment({ orderId: "order_other1" }));
    const response = await verify(h, "pay_123abc", "order_other1", signatureForCheckout("order_other1", "pay_123abc"));
    assert.equal(response.statusCode, 404);
    assert.equal(response.payload.code, "PAYMENT_ATTEMPT_NOT_FOUND");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
  });
});

test("same captured payment delivered under different webhook event IDs stays idempotent", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const first = await webhook(h, { payment: captured, eventId: "evt_capture_first" });
  const second = await webhook(h, { payment: captured, eventId: "evt_capture_retry" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.paymentTransactions.length, 1);
  assert.equal(h.state.webhookEvents.length, 2);
  assert.ok(h.state.webhookEvents.every((event) => event.status === "PROCESSED"));
  assert.equal(first.payload.additionalCaptureNeedsReconciliation, false);
  assert.equal(first.payload.additionalCaptureDetected, false);
  assert.equal(second.payload.additionalCaptureNeedsReconciliation, false);
  assert.equal(second.payload.additionalCaptureDetected, false);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("concurrent duplicate webhook deliveries claim one event and release one order", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const responses = await Promise.all(Array.from({ length: 5 }, () => webhook(h, {
    payment: captured,
    eventId: "evt_concurrent_duplicate",
  })));

  assert.ok(responses.every((response) => response.statusCode === 200));
  assert.equal(h.state.webhookEvents.length, 1);
  assert.equal(h.state.webhookEvents[0].status, "PROCESSED");
  assert.equal(h.state.webhookEvents[0].processingAttempts, 1);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.paymentTransactions.length, 1);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("late failed webhook after capture does not regress payment or order state", async () => {
  const h = createHarness();
  seedPayment(h);
  const captured = gatewayPayment();
  h.gateway.paymentsById.set(captured.id, captured);

  const captureResponse = await webhook(h, { payment: captured, eventId: "evt_capture_before_failure" });
  const lateFailure = { ...captured, status: "failed" };
  h.gateway.paymentsById.set(lateFailure.id, lateFailure);
  const failureResponse = await webhook(h, {
    event: "payment.failed",
    payment: lateFailure,
    eventId: "evt_late_failure_after_capture",
  });

  assert.equal(captureResponse.statusCode, 200);
  assert.equal(failureResponse.statusCode, 200);
  assert.equal(h.state.payments[0].status, "SUCCESS");
  assert.equal(h.state.orders[0].status, "PLACED");
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.paymentTransactions.length, 1);
  assert.equal(h.state.webhookEvents[1].status, "PROCESSED");
});

test("a second captured payment ID under the same Razorpay order and attempt is flagged once", async () => {
  const h = createHarness();
  seedPayment(h, { gatewayOrderId: "order_sharedcapture", idempotencyKey: "attempt-shared-capture" });
  const firstCapture = gatewayPayment({ id: "pay_sharedfirst", orderId: "order_sharedcapture" });
  const secondCapture = gatewayPayment({ id: "pay_sharedsecond", orderId: "order_sharedcapture" });
  h.gateway.paymentsById.set(firstCapture.id, firstCapture);
  h.gateway.paymentsById.set(secondCapture.id, secondCapture);

  const first = await verify(h, firstCapture.id, firstCapture.order_id);
  const second = await verify(h, secondCapture.id, secondCapture.order_id);
  const replay = await verify(h, secondCapture.id, secondCapture.order_id);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(second.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(second.payload.additionalCaptureDetected, true);
  assert.equal(replay.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(replay.payload.additionalCaptureDetected, false);
  assert.equal(h.state.paymentTransactions.length, 2);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("a distinct additional capture delivered by webhook is flagged without a second release", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_webhookfirst", idempotencyKey: "attempt-webhook-first" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_webhooksecond", idempotencyKey: "attempt-webhook-second" });
  const firstCapture = gatewayPayment({ id: "pay_webhookfirst", orderId: "order_webhookfirst" });
  const secondCapture = gatewayPayment({ id: "pay_webhooksecond", orderId: "order_webhooksecond" });
  h.gateway.paymentsById.set(firstCapture.id, firstCapture);
  h.gateway.paymentsById.set(secondCapture.id, secondCapture);

  const first = await webhook(h, { payment: firstCapture, eventId: "evt_webhookfirst" });
  const second = await webhook(h, { payment: secondCapture, eventId: "evt_webhooksecond" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.payload.additionalCaptureNeedsReconciliation, false);
  assert.equal(second.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(second.payload.additionalCaptureDetected, true);
  assert.equal(h.state.paymentTransactions.length, 2);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("payment recovery retains the additional-capture signal across multiple captured candidates", async () => {
  const h = createHarness();
  seedPayment(h, { gatewayOrderId: "order_recoverymulti", idempotencyKey: "attempt-recovery-multi" });
  const firstCapture = gatewayPayment({ id: "pay_recoveryfirst", orderId: "order_recoverymulti" });
  const secondCapture = gatewayPayment({ id: "pay_recoverysecond", orderId: "order_recoverymulti" });
  h.gateway.paymentsById.set(firstCapture.id, firstCapture);
  h.gateway.paymentsById.set(secondCapture.id, secondCapture);
  h.gateway.fetchPaymentsForOrder = async () => [firstCapture, secondCapture];

  const response = await invoke(h.controller.getPaymentAttemptsForOrder, h, {
    params: { orderId: "1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(response.payload.additionalCaptureDetected, true);
  assert.equal(response.payload.order.additionalCaptureNeedsReconciliation, true);
  assert.equal(h.state.paymentTransactions.length, 2);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("concurrent checkout and webhook captures flag only the additional distinct payment", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_racefirst", idempotencyKey: "attempt-race-first" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_racesecond", idempotencyKey: "attempt-race-second" });
  const firstCapture = gatewayPayment({ id: "pay_racefirst", orderId: "order_racefirst" });
  const secondCapture = gatewayPayment({ id: "pay_racesecond", orderId: "order_racesecond" });
  h.gateway.paymentsById.set(firstCapture.id, firstCapture);
  h.gateway.paymentsById.set(secondCapture.id, secondCapture);

  const [checkoutResponse, webhookResponse] = await Promise.all([
    verify(h, firstCapture.id, firstCapture.order_id),
    webhook(h, { payment: secondCapture, eventId: "evt_race_second_capture" }),
  ]);

  assert.equal(checkoutResponse.statusCode, 200);
  assert.equal(webhookResponse.statusCode, 200);
  assert.equal(
    Number(checkoutResponse.payload.additionalCaptureDetected) + Number(webhookResponse.payload.additionalCaptureDetected),
    1,
  );
  assert.ok(checkoutResponse.payload.additionalCaptureNeedsReconciliation || webhookResponse.payload.additionalCaptureNeedsReconciliation);
  assert.equal(h.state.paymentTransactions.length, 2);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.equal(h.state.dailyTokenCounter[0].lastToken, 101);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});

test("webhook rejects missing or malformed raw body and retries unknown payment references", async (t) => {
  await t.test("missing raw body", async () => {
    const h = createHarness();
    const response = await invoke(h.controller.handleRazorpayWebhook, h, {
      body: { event: "payment.captured" },
      headers: { "x-razorpay-signature": "a".repeat(64) },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.code, "INVALID_WEBHOOK_BODY");
    assert.equal(h.state.webhookEvents.length, 0);
  });

  await t.test("malformed signed raw body", async () => {
    const h = createHarness();
    const rawBody = Buffer.from("{not-json");
    const response = await invoke(h.controller.handleRazorpayWebhook, h, {
      rawBody,
      headers: { "x-razorpay-signature": signWebhook(rawBody) },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.code, "INVALID_WEBHOOK_PAYLOAD");
    assert.equal(h.state.webhookEvents.length, 0);
  });

  await t.test("unmatched payment attempt is retryable and recorded as failed", async () => {
    const h = createHarness();
    const captured = gatewayPayment({ id: "pay_unknown2" });
    h.gateway.paymentsById.set(captured.id, captured);
    const response = await webhook(h, { payment: captured, eventId: "evt_unknown_payment" });
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.code, "PAYMENT_ATTEMPT_NOT_FOUND");
    assert.equal(h.state.orders[0].status, "PENDING_PAYMENT");
    assert.equal(h.state.webhookEvents[0].status, "FAILED");
  });
});

test("socket notification exceptions do not roll back a confirmed payment", async () => {
  const h = createHarness();
  seedPayment(h);
  h.gateway.paymentsById.set("pay_123abc", gatewayPayment());
  h.io.emit = () => { throw new Error("simulated socket outage"); };

  const response = await verify(h);

  assert.equal(response.statusCode, 200);
  assert.equal(h.state.payments[0].status, "SUCCESS");
  assert.equal(h.state.orders[0].status, "PLACED");
  assert.equal(h.state.orders[0].tokenNumber, 101);
});

test("QR order endpoint rejects a client attempt to disable required payment", async () => {
  const { createOrder } = require("../src/controllers/orderController");
  const response = await invoke(createOrder, createHarness(), {
    body: { branchId: 1, items: [{ menuItemId: 1, quantity: 1 }], idempotencyKey: "order-test-key-001", paymentRequired: false },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, "PAYMENT_REQUIRED");
});

test("refund from an order with multiple successful captures is tied to the selected payment record", async () => {
  const h = createHarness();
  h.state.orders[0].status = "PLACED";
  seedPayment(h, {
    id: 1,
    status: "SUCCESS",
    amount: 100,
    gatewayOrderId: "order_refund_first",
    gatewayPaymentId: "pay_refund_first",
  });
  seedPayment(h, {
    id: 2,
    status: "SUCCESS",
    amount: 100,
    gatewayOrderId: "order_refund_second",
    gatewayPaymentId: "pay_refund_second",
    idempotencyKey: "attempt-key-second-success",
  });
  let refundedPaymentId = null;
  h.gateway.refundPayment = async (paymentId, amount, idempotencyKey) => {
    refundedPaymentId = paymentId;
    return {
      id: "rfnd_multiple01",
      payment_id: paymentId,
      amount: Math.round(amount * 100),
      status: "processed",
      notes: { idempotencyKey },
    };
  };

  const response = await invoke(h.controller.refundRazorpayPayment, h, {
    body: { orderId: 1, amount: 30, idempotencyKey: "refund-multiple-key-01" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(refundedPaymentId, "pay_refund_first");
  assert.equal(h.state.paymentRefunds[0].paymentId, 1);
  assert.equal(h.state.paymentTransactions.at(-1).paymentId, 1);
});

test("a second distinct captured payment is explicitly flagged for reconciliation", async () => {
  const h = createHarness();
  seedPayment(h, { id: 1, gatewayOrderId: "order_captureone", idempotencyKey: "attempt-capture-one" });
  seedPayment(h, { id: 2, gatewayOrderId: "order_capturetwo", idempotencyKey: "attempt-capture-two" });
  const firstCapture = gatewayPayment({ id: "pay_captureone", orderId: "order_captureone" });
  const secondCapture = gatewayPayment({ id: "pay_capturetwo", orderId: "order_capturetwo" });
  h.gateway.paymentsById.set(firstCapture.id, firstCapture);
  h.gateway.paymentsById.set(secondCapture.id, secondCapture);

  const first = await verify(h, firstCapture.id, firstCapture.order_id);
  const second = await verify(h, secondCapture.id, secondCapture.order_id);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(h.state.orders[0].tokenNumber, 101);
  assert.deepEqual(
    h.state.paymentTransactions.map(({ paymentId, gatewayPaymentId }) => ({ paymentId, gatewayPaymentId }))
      .sort((a, b) => a.paymentId - b.paymentId),
    [
      { paymentId: 1, gatewayPaymentId: firstCapture.id },
      { paymentId: 2, gatewayPaymentId: secondCapture.id },
    ],
  );
  assert.equal(second.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(second.payload.additionalCaptureDetected, true);

  const replay = await verify(h, secondCapture.id, secondCapture.order_id);
  assert.equal(replay.payload.additionalCaptureNeedsReconciliation, true);
  assert.equal(replay.payload.additionalCaptureDetected, false);
  assert.equal(h.state.paymentTransactions.length, 2);
  assert.equal(h.emitted.filter(([event]) => event === "NEW_ORDER").length, 1);
});





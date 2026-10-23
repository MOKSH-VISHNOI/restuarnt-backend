if (process.env.PRISMA_MOCK === '1') {
  // Lightweight in-memory mock for local testing without a real database.
  const uuid = (() => {
    let n = 1;
    return () => String(n++);
  })();

  const state = {
    orders: [
      {
        id: 1,
        status: 'PENDING_PAYMENT',
        totalAmount: 100,
        items: [],
        payments: [],
      },
    ],
    menuItems: [],
    payments: [],
    paymentTransactions: [],
    paymentRefunds: [],
    webhookEvents: [],
    dailyTokenCounter: [],
  };
  let transactionQueue = Promise.resolve();

  const findOrderById = (id) => state.orders.find((o) => o.id === id);

  // Helper to apply Prisma-like update shapes, including { field: { increment: N } }
  const applyData = (obj, data) => {
    if (!data) return;
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'increment') && typeof v.increment === 'number') {
        obj[k] = (obj[k] || 0) + v.increment;
      } else {
        obj[k] = v;
      }
    }
    obj.updatedAt = new Date();
  };

  const prismaMock = {
    order: {
      findUnique: async ({ where, include }) => {
        const order = where.idempotencyKey !== undefined
          ? state.orders.find((item) => item.idempotencyKey === where.idempotencyKey)
          : findOrderById(where.id);
        if (!order) return null;
        const id = order.id;
        const copy = { ...order };
        if (include && include.payments) {
          copy.payments = state.payments
            .filter((p) => p.orderId === id)
            .map((payment) => {
              const paymentCopy = { ...payment };
              if (include.payments.include && include.payments.include.transactions) {
                paymentCopy.transactions = state.paymentTransactions
                  .filter((transaction) => transaction.paymentId === payment.id)
                  .map((transaction) => ({ ...transaction }));
              }
              return paymentCopy;
            });
        }
        if (include && include.items) {
          copy.items = order.items || [];
        }
        return copy;
      },
      findFirst: async ({ where, orderBy, include }) => {
        let matches = state.orders.filter((order) => {
          if (where?.tokenNumber !== undefined && order.tokenNumber !== where.tokenNumber) return false;
          if (where?.createdAt?.gte && !(order.createdAt >= where.createdAt.gte)) return false;
          if (where?.createdAt?.lt && !(order.createdAt < where.createdAt.lt)) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          matches = matches.sort((a, b) => b.createdAt - a.createdAt);
        }
        const order = matches[0];
        if (!order) return null;
        const copy = { ...order };
        if (include?.items) copy.items = order.items || [];
        return copy;
      },
      create: async ({ data, include }) => {
        if (data.idempotencyKey && state.orders.some((order) => order.idempotencyKey === data.idempotencyKey)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const id = Math.max(0, ...state.orders.map((order) => order.id)) + 1;
        const order = { id, createdAt: new Date(), ...data };
        order.items = (data.items?.create || []).map((item) => ({
          id: Number(uuid()),
          ...item,
          menuItem: state.menuItems.find((menuItem) => menuItem.id === item.menuItemId) || null,
        }));
        state.orders.push(order);
        const copy = { ...order };
        if (include?.items) copy.items = order.items.map((item) => ({ ...item }));
        return copy;
      },
      update: async ({ where, data, include }) => {
        const id = where.id;
        const order = findOrderById(id);
        if (!order) throw new Error('Order not found');
        Object.assign(order, data);
        const copy = { ...order };
        if (include && include.items) copy.items = order.items || [];
        return copy;
      },
      updateMany: async ({ where, data }) => {
        const matches = state.orders.filter((order) => {
          if (where.id !== undefined && order.id !== where.id) return false;
          if (where.status && order.status !== where.status) return false;
          if (Object.prototype.hasOwnProperty.call(where, "tokenNumber") && order.tokenNumber !== where.tokenNumber) return false;
          return true;
        });
        matches.forEach((order) => applyData(order, data));
        return { count: matches.length };
      },
    },
    menuItem: {
      findMany: async ({ where } = {}) => state.menuItems.filter((item) =>
        !where?.id?.in || where.id.in.includes(item.id)).map((item) => ({ ...item })),
    },
    payment: {
      findUnique: async ({ where }) => {
        if (where.id) return state.payments.find((p) => p.id === where.id) || null;
        if (where.idempotencyKey) return state.payments.find((p) => p.idempotencyKey === where.idempotencyKey) || null;
        return null;
      },
      findFirst: async ({ where, include }) => {
        if (where.gateway && where.gatewayOrderId) {
          const p = state.payments.find((p) => p.gateway === where.gateway && p.gatewayOrderId === where.gatewayOrderId) || null;
          if (!p) return null;
          const copy = { ...p };
          if (include && include.order) {
            const ord = state.orders.find((o) => o.id === p.orderId);
            if (ord) {
              copy.order = { ...ord };
              if (include.order.include && include.order.include.items) {
                copy.order.items = ord.items || [];
              }
            }
          }
          return copy;
        }
        return null;
      },
      create: async ({ data }) => {
        const id = Number(uuid());
        const rec = Object.assign({ id, createdAt: new Date(), updatedAt: new Date() }, data);
        state.payments.push(rec);
        const copy = { ...rec };
        return copy;
      },
      update: async ({ where, data }) => {
        const p = state.payments.find((x) => x.id === where.id);
        if (!p) throw new Error('Payment not found');
        applyData(p, data);
        return { ...p };
      },
      updateMany: async ({ where, data }) => {
        const matched = state.payments.filter((p) => {
          if (where.id && p.id !== where.id) return false;
          if (typeof where.status === 'string' && p.status !== where.status) return false;
          if (where.status && where.status.in && !where.status.in.includes(p.status)) return false;
          if (where.status && where.status.not && p.status === where.status.not) return false;
          if (Object.prototype.hasOwnProperty.call(where, 'gatewayOrderId') && (where.gatewayOrderId === null ? p.gatewayOrderId != null : p.gatewayOrderId !== where.gatewayOrderId)) return false;
          if (where.gateway && p.gateway !== where.gateway) return false;
          return true;
        });
        matched.forEach((p) => { applyData(p, data); });
        return { count: matched.length };
      },
      findMany: async ({ where }) => {
        return state.payments.filter((p) => p.orderId === where.orderId);
      },
    },
    paymentTransaction: {
      findUnique: async ({ where }) => {
        const transaction = state.paymentTransactions.find((item) =>
          (where.gatewayPaymentId !== undefined && item.gatewayPaymentId === where.gatewayPaymentId) ||
          (where.refundRequestKey !== undefined && item.refundRequestKey === where.refundRequestKey));
        return transaction ? { ...transaction } : null;
      },
      upsert: async ({ where, create, update }) => {
        let transaction = state.paymentTransactions.find((item) => item.gatewayPaymentId === where.gatewayPaymentId);
        if (transaction) {
          applyData(transaction, update);
        } else {
          transaction = Object.assign({ id: Number(uuid()), createdAt: new Date(), updatedAt: new Date() }, create);
          state.paymentTransactions.push(transaction);
        }
        return { ...transaction };
      },
    },
    paymentRefund: {
      findUnique: async ({ where }) => state.paymentRefunds.find((refund) =>
        (where.id !== undefined && refund.id === where.id) ||
        (where.idempotencyKey !== undefined && refund.idempotencyKey === where.idempotencyKey)) || null,
      findMany: async ({ where }) => state.paymentRefunds.filter((refund) =>
        (where.paymentId === undefined || refund.paymentId === where.paymentId) &&
        (where.status === undefined ||
          (typeof where.status === 'string' ? refund.status === where.status :
            (!where.status?.in || where.status.in.includes(refund.status))))).map((refund) => ({ ...refund })),
      create: async ({ data }) => {
        if (state.paymentRefunds.some((refund) => refund.idempotencyKey === data.idempotencyKey)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const refund = Object.assign({ id: Number(uuid()), createdAt: new Date(), updatedAt: new Date() }, data);
        state.paymentRefunds.push(refund);
        return { ...refund };
      },
      update: async ({ where, data }) => {
        const refund = state.paymentRefunds.find((item) => item.id === where.id);
        if (!refund) throw new Error('Refund not found');
        applyData(refund, data);
        return { ...refund };
      },
    },
    dailyTokenCounter: {
      upsert: async ({ where, create, update }) => {
        const d = where.counterDate;
        let rec = state.dailyTokenCounter.find((x) => x.counterDate && x.counterDate.toString() === d.toString());
        if (!rec) {
          rec = { id: Number(uuid()), counterDate: d, lastToken: create.lastToken };
          state.dailyTokenCounter.push(rec);
        }
        return { ...rec };
      },
      update: async ({ where, data }) => {
        const d = where.counterDate;
        let rec = state.dailyTokenCounter.find((x) => x.counterDate && x.counterDate.toString() === d.toString());
        if (!rec) throw new Error('Counter not found');
        if (data.lastToken && data.lastToken.increment) rec.lastToken += data.lastToken.increment;
        return { ...rec };
      },
    },
    webhookEvent: {
      create: async ({ data }) => {
        if (data.externalEventId && state.webhookEvents.some((event) => event.gateway === data.gateway && event.externalEventId === data.externalEventId)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const rec = Object.assign({ id: Number(uuid()), receivedAt: new Date(), status: data.status || 'RECEIVED', processingAttempts: 0 }, data);
        state.webhookEvents.push(rec);
        return { ...rec };
      },
      findUnique: async ({ where }) => {
        if (where.gateway_externalEventId) {
          const { gateway, externalEventId } = where.gateway_externalEventId;
          return state.webhookEvents.find((w) => w.gateway === gateway && w.externalEventId === externalEventId) || null;
        }
        if (where.id) return state.webhookEvents.find((w) => w.id === where.id) || null;
        return null;
      },
      update: async ({ where, data }) => {
        const w = state.webhookEvents.find((x) => x.id === where.id);
        if (!w) throw new Error('webhook event not found');
        applyData(w, data);
        return { ...w };
      },
      updateMany: async ({ where, data }) => {
        const matched = state.webhookEvents.filter((event) => {
          if (where.id !== undefined && event.id !== where.id) return false;
          if (typeof where.status === 'string' && event.status !== where.status) return false;
          if (where.status && where.status.in && !where.status.in.includes(event.status)) return false;
          return true;
        });
        matched.forEach((event) => applyData(event, data));
        return { count: matched.length };
      },
    },
    $executeRaw: async () => {
      // noop for advisory lock in mock
      return;
    },
    $transaction: async (fn) => {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const snapshot = structuredClone(state);
      try {
        return await fn(prismaMock);
      } catch (error) {
        state.orders = snapshot.orders;
        state.menuItems = snapshot.menuItems;
        state.payments = snapshot.payments;
        state.paymentTransactions = snapshot.paymentTransactions;
        state.paymentRefunds = snapshot.paymentRefunds;
        state.webhookEvents = snapshot.webhookEvents;
        state.dailyTokenCounter = snapshot.dailyTokenCounter;
        throw error;
      } finally {
        release();
      }
    },
  };

  // expose raw state for testing/debug endpoints
  prismaMock._rawState = state;

  module.exports = prismaMock;
} else {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  module.exports = prisma;
}

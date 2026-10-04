"use client";

import {
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useState } from "react";

type OrderStatus =
  | "Placed"
  | "Preparing"
  | "Ready"
  | "Delayed"
  | "Collected";

type Order = {
  id: string;
  token: string;
  store: string;
  items: {
    name: string;
    quantity: number;
  }[];
  amount: string;
  payment: string;
  paymentStatus: string;
  status: OrderStatus;
  placedAt: string;
  elapsed: string;
};

const orders: Order[] = [
  {
    id: "ORD-10428",
    token: "A42",
    store: "Indore 1",
    items: [
      { name: "Paneer Sandwich", quantity: 1 },
      { name: "Cold Coffee", quantity: 1 },
    ],
    amount: "₹240",
    payment: "UPI",
    paymentStatus: "Paid",
    status: "Preparing",
    placedAt: "9:18 PM",
    elapsed: "6m 42s",
  },
  {
    id: "ORD-10427",
    token: "A41",
    store: "Indore 2",
    items: ["Veg Cheese Sandwich"],
    amount: "₹140",
    payment: "Card",
    paymentStatus: "Paid",
    status: "Ready",
    placedAt: "9:15 PM",
    elapsed: "3m 28s",
  },
  {
    id: "ORD-10426",
    token: "A18",
    store: "Indore 1",
    items: ["Paneer Sandwich", "French Fries"],
    amount: "₹220",
    payment: "UPI",
    paymentStatus: "Paid",
    status: "Placed",
    placedAt: "9:21 PM",
    elapsed: "2m 11s",
  },
  {
    id: "ORD-10425",
    token: "C07",
    store: "Indore 3",
    items: ["Corn Cheese Sandwich"],
    amount: "₹160",
    payment: "Cash",
    paymentStatus: "Pending",
    status: "Preparing",
    placedAt: "9:12 PM",
    elapsed: "9m 04s",
  },
  {
    id: "ORD-10424",
    token: "D31",
    store: "Indore 4",
    items: ["Paneer Sandwich", "Lime Soda"],
    amount: "₹210",
    payment: "UPI",
    paymentStatus: "Paid",
    status: "Delayed",
    placedAt: "9:05 PM",
    elapsed: "16m 21s",
  },
  {
    id: "ORD-10423",
    token: "B40",
    store: "Indore 2",
    items: ["Veg Cheese Sandwich"],
    amount: "₹140",
    payment: "UPI",
    paymentStatus: "Paid",
    status: "Ready",
    placedAt: "9:10 PM",
    elapsed: "8m 12s",
  },
  {
    id: "ORD-10422",
    token: "B17",
    store: "Indore 1",
    items: ["Paneer Sandwich"],
    amount: "₹120",
    payment: "Card",
    paymentStatus: "Paid",
    status: "Collected",
    placedAt: "8:58 PM",
    elapsed: "5m 44s",
  },
  {
    id: "ORD-10421",
    token: "C06",
    store: "Indore 3",
    items: ["Veg Cheese Sandwich", "Cold Coffee"],
    amount: "₹210",
    payment: "UPI",
    paymentStatus: "Paid",
    status: "Collected",
    placedAt: "8:52 PM",
    elapsed: "7m 18s",
  },
];

const liveStatuses = [
  "All",
  "Placed",
  "Preparing",
  "Ready",
  "Delayed",
];

const historyStatuses = [
  "All",
  "Collected",
  "Cancelled",
  "Refunded",
];

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    Placed: "bg-blue-400/10 text-blue-400 border-blue-400/15",
    Preparing: "bg-amber-400/10 text-amber-400 border-amber-400/15",
    Ready: "bg-emerald-400/10 text-emerald-400 border-emerald-400/15",
    Delayed: "bg-red-400/10 text-red-400 border-red-400/15",
    Collected: "bg-slate-400/10 text-slate-300 border-slate-400/10",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function FilterButton({
  icon: Icon,
  label,
}: {
  icon: typeof Store;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#081017] px-3 text-xs text-slate-300 transition-colors hover:border-white/[0.14] hover:text-white"
    >
      <Icon size={14} className="text-slate-500" />
      {label}
      <ChevronDown size={13} className="ml-1 text-slate-600" />
    </button>
  );
}

export default function OrdersPage() {
  const [view, setView] = useState<"live" | "history">("live");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const visibleOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.token.toLowerCase().includes(search.toLowerCase()) ||
      order.store.toLowerCase().includes(search.toLowerCase()) ||
      order.items.some((item) =>
        item.toLowerCase().includes(search.toLowerCase())
      );

    const matchesView =
      view === "live"
        ? order.status !== "Collected"
        : order.status === "Collected";

    const matchesStatus =
      statusFilter === "All" || order.status === statusFilter;

    return matchesSearch && matchesView && matchesStatus;
  });

  const currentStatuses =
    view === "live" ? liveStatuses : historyStatuses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#f5b942]/75">
            Order Management
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Orders
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Monitor live orders and review completed order history.
          </p>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Live orders</p>
            <p className="mt-1 font-semibold text-white">34</p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">Today's orders</p>
            <p className="mt-1 font-semibold text-white">428</p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">Today's revenue</p>
            <p className="mt-1 font-semibold text-[#f5b942]">
              ₹51,360
            </p>
          </div>
        </div>
      </section>

      {/* View switch */}
      <section className="flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-[#081017] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-lg border border-white/[0.07] bg-[#05090d] p-1">
          <button
            type="button"
            onClick={() => {
              setView("live");
              setStatusFilter("All");
            }}
            className={`flex h-9 items-center gap-2 rounded-md px-5 text-xs font-medium transition-all ${
              view === "live"
                ? "bg-[#2a1d0b] text-[#f5b942]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                view === "live"
                  ? "bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]"
                  : "bg-slate-600"
              }`}
            />
            Live Orders
          </button>

          <button
            type="button"
            onClick={() => {
              setView("history");
              setStatusFilter("All");
            }}
            className={`flex h-9 items-center gap-2 rounded-md px-5 text-xs font-medium transition-all ${
              view === "history"
                ? "bg-[#2a1d0b] text-[#f5b942]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarDays size={14} />
            History
          </button>
        </div>

        {view === "live" && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />
            Live data
            <span className="text-slate-600">•</span>
            Updated just now
          </div>
        )}
      </section>

      {/* Filters */}
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, token, store or item..."
            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#081017] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#f5b942]/40"
          />
        </div>

        <FilterButton icon={Store} label="All Stores" />

        <FilterButton icon={CreditCard} label="All Payments" />

        {view === "history" && (
          <FilterButton icon={CalendarDays} label="Today" />
        )}
      </section>

      {/* Status tabs */}
      <section className="flex items-center gap-2 overflow-x-auto border-b border-white/[0.07]">
        {currentStatuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`relative whitespace-nowrap px-4 pb-3 text-xs font-medium transition-colors ${
              statusFilter === status
                ? "text-[#f5b942]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {status}

            {statusFilter === status && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-[#f5b942]" />
            )}
          </button>
        ))}
      </section>

      {/* Orders table */}
      <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#081017]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {view === "live" ? "Live Orders" : "Order History"}
            </h2>

            <p className="mt-1 text-[11px] text-slate-500">
              {view === "live"
                ? "Orders currently moving through the restaurant workflow."
                : "Completed orders from the selected period."}
            </p>
          </div>

          <span className="text-[11px] text-slate-500">
            {visibleOrders.length} orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-slate-600">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Store</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.015]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a1d0b] text-xs font-semibold text-[#f5b942]">
                        {order.token}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white">
                          {order.id}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {order.placedAt}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {order.store}
                  </td>

                  <td className="max-w-[220px] px-5 py-4">
                    <p className="truncate text-sm text-slate-300">
                    {order.items.map((item) => item.name).join(", ")}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {order.items.length} item
                      {order.items.length > 1 ? "s" : ""}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-white">
                    {order.amount}
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-300">
                      {order.payment}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        order.paymentStatus === "Paid"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {order.paymentStatus}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={order.status} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Clock3 size={13} className="text-slate-600" />
                      {order.elapsed}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.07] px-3 text-[11px] text-slate-400 transition-colors hover:border-[#f5b942]/30 hover:text-[#f5b942]"
                    >
                      <Eye size={13} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleOrders.length === 0 && (
          <div className="flex min-h-48 flex-col items-center justify-center">
            <ShoppingBag size={25} className="text-slate-700" />

            <p className="mt-3 text-sm text-slate-400">
              No orders found
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Try changing your filters or search.
            </p>
          </div>
        )}
      </section>

      {/* Detail drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setSelectedOrder(null)}
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-[#070d12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#f5b942]/75">
                  Order Details
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  {selectedOrder.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Token */}
              <div className="rounded-xl border border-[#f5b942]/10 bg-[#2a1d0b]/40 p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Token
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-3xl font-semibold text-[#f5b942]">
                    {selectedOrder.token}
                  </span>

                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              {/* Order information */}
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Order Information
                </h3>

                <div className="mt-3 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Store</span>
                    <span className="text-sm text-white">
                      {selectedOrder.store}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">
                      Placed at
                    </span>
                    <span className="text-sm text-white">
                      {selectedOrder.placedAt}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">
                      Elapsed
                    </span>
                    <span className="text-sm text-white">
                      {selectedOrder.elapsed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mt-7">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Items
                </h3>

                <div className="mt-3 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-sm text-slate-300">
                        {item.name}
                      </span>

                      <span className="text-xs text-slate-600">
                        × {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-sm text-slate-500">
                    Total
                  </span>

                  <span className="text-base font-semibold text-white">
                    {selectedOrder.amount}
                  </span>
                </div>
              </div>

              {/* Payment */}
              <div className="mt-7">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Payment
                </h3>

                <div className="mt-3 rounded-lg border border-white/[0.06] p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">
                      Method
                    </span>
                    <span className="text-sm text-white">
                      {selectedOrder.payment}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between">
                    <span className="text-sm text-slate-500">
                      Status
                    </span>
                    <span className="text-sm text-emerald-400">
                      {selectedOrder.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-7">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Order Timeline
                </h3>

                <div className="mt-4 space-y-4">
                  {[
                    "Order placed",
                    "Payment successful",
                    "Kitchen received",
                    "Preparing",
                    "Ready",
                    "Collected",
                  ].map((event, index) => {
                    const isComplete =
                      selectedOrder.status === "Collected"
                        ? true
                        : index <
                          [
                            "Placed",
                            "Preparing",
                            "Ready",
                            "Delayed",
                          ].indexOf(selectedOrder.status) +
                            2;

                    return (
                      <div
                        key={event}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={`mt-1 h-2 w-2 rounded-full ${
                            isComplete
                              ? "bg-[#f5b942]"
                              : "bg-slate-700"
                          }`}
                        />

                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              isComplete
                                ? "text-slate-200"
                                : "text-slate-600"
                            }`}
                          >
                            {event}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Settings,
  ShoppingBag,
  Store as StoreIcon,
  X,
} from "lucide-react";
import { useState } from "react";

type StoreData = {
  id: number;
  name: string;
  location: string;
  status: "Open" | "Closed";
  orders: number;
  revenue: string;
  prepTime: string;
  delayed: number;
  active: number;
};

const stores: StoreData[] = [
  {
    id: 1,
    name: "Indore 1",
    location: "Main Store",
    status: "Open",
    orders: 152,
    revenue: "₹18,240",
    prepTime: "7m 42s",
    delayed: 1,
    active: 9,
  },
  {
    id: 2,
    name: "Indore 2",
    location: "Vijay Nagar",
    status: "Open",
    orders: 139,
    revenue: "₹16,680",
    prepTime: "8m 31s",
    delayed: 2,
    active: 14,
  },
  {
    id: 3,
    name: "Indore 3",
    location: "Palasia",
    status: "Open",
    orders: 91,
    revenue: "₹10,920",
    prepTime: "9m 14s",
    delayed: 0,
    active: 6,
  },
  {
    id: 4,
    name: "Indore 4",
    location: "Rau",
    status: "Open",
    orders: 46,
    revenue: "₹5,520",
    prepTime: "10m 02s",
    delayed: 0,
    active: 5,
  },
];

const storeOrderSnapshot = [
  {
    token: "A42",
    order: "ORD-10428",
    items: "Paneer Sandwich, Cold Coffee",
    amount: "₹240",
    status: "Preparing",
  },
  {
    token: "A18",
    order: "ORD-10426",
    items: "Paneer Sandwich, French Fries",
    amount: "₹220",
    status: "Placed",
  },
  {
    token: "A17",
    order: "ORD-10422",
    items: "Paneer Sandwich",
    amount: "₹120",
    status: "Ready",
  },
];

const paymentRows = [
  {
    source: "UPI",
    orders: 68,
    amount: "₹8,160",
    percentage: 45,
  },
  {
    source: "Card",
    orders: 42,
    amount: "₹5,040",
    percentage: 28,
  },
  {
    source: "Cash",
    orders: 27,
    amount: "₹3,240",
    percentage: 18,
  },
  {
    source: "Other",
    orders: 13,
    amount: "₹1,560",
    percentage: 9,
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-emerald-400/10 text-emerald-400 border-emerald-400/15",
    Closed: "bg-slate-400/10 text-slate-400 border-slate-400/10",
    Placed: "bg-blue-400/10 text-blue-400 border-blue-400/15",
    Preparing: "bg-amber-400/10 text-amber-400 border-amber-400/15",
    Ready: "bg-emerald-400/10 text-emerald-400 border-emerald-400/15",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-medium ${
        styles[status] ??
        "bg-slate-400/10 text-slate-400 border-slate-400/10"
      }`}
    >
      {status}
    </span>
  );
}

function DetailAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-lg border border-white/[0.06] bg-[#081017] p-4 text-left transition-colors hover:border-[#f5b942]/20 hover:bg-[#0b141c]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
        <Icon size={17} strokeWidth={1.8} />
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <ArrowRight
        size={15}
        className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-[#f5b942]"
      />
    </button>
  );
}

export default function StoresPage() {
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(
    null
  );

  const [detailView, setDetailView] = useState<
    "overview" | "orders" | "payments" | "operations" | "settings"
  >("overview");

  const openStore = (store: StoreData) => {
    setSelectedStore(store);
    setDetailView("overview");
  };

  const closeStore = () => {
    setSelectedStore(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#f5b942]/75">
            Store Management
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Stores
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            View the current operational state of each store.
          </p>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Total stores</p>
            <p className="mt-1 font-semibold text-white">4</p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">Open</p>
            <p className="mt-1 font-semibold text-emerald-400">4</p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">Active orders</p>
            <p className="mt-1 font-semibold text-[#f5b942]">34</p>
          </div>
        </div>
      </section>

      {/* Store selector */}
      <section className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#081017] px-5 py-4">
        <div>
          <p className="text-xs text-slate-500">Viewing</p>
          <p className="mt-1 text-sm font-medium text-white">
            All Stores
          </p>
        </div>

        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#05090d] px-3 text-xs text-slate-300 hover:border-white/[0.15] hover:text-white"
        >
          <StoreIcon size={14} className="text-slate-500" />
          All Stores
          <ChevronDown size={13} className="text-slate-600" />
        </button>
      </section>

      {/* Store table */}
      <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#081017]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Store Directory
            </h2>

            <p className="mt-1 text-[11px] text-slate-500">
              Today's operational snapshot for each store.
            </p>
          </div>

          <span className="text-[11px] text-slate-500">
            4 stores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-slate-600">
                <th className="px-5 py-3 font-medium">Store</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Orders Today</th>
                <th className="px-5 py-3 font-medium">Revenue Today</th>
                <th className="px-5 py-3 font-medium">
                  Avg Preparation
                </th>
                <th className="px-5 py-3 font-medium">Delayed</th>
                <th className="px-5 py-3 font-medium">Active</th>
                <th className="px-5 py-3 text-right font-medium">
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {stores.map((store) => (
                <tr
                  key={store.id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
                        <StoreIcon size={16} />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white">
                          {store.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {store.location}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={store.status} />
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.orders}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.revenue}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.prepTime}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={
                        store.delayed > 0
                          ? "text-sm font-medium text-red-400"
                          : "text-sm text-slate-500"
                      }
                    >
                      {store.delayed}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.active}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openStore(store)}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.07] px-3 text-[11px] text-slate-400 transition-colors hover:border-[#f5b942]/30 hover:text-[#f5b942]"
                    >
                      View
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Store detail drawer */}
      {selectedStore && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={closeStore}
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/[0.08] bg-[#070d12] shadow-2xl">
            {/* Drawer header */}
            <div className="border-b border-white/[0.07] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#f5b942]/75">
                    Store Detail
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {selectedStore.name}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedStore.location}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeStore}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.05] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <StatusBadge status={selectedStore.status} />

                <span className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />
                  Live data
                </span>
              </div>
            </div>

            {/* Drawer navigation */}
            <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-5">
              {[
                { id: "overview", label: "Overview" },
                { id: "orders", label: "Orders" },
                { id: "payments", label: "Payments" },
                { id: "operations", label: "Operations" },
                { id: "settings", label: "Settings" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setDetailView(
                      tab.id as
                        | "overview"
                        | "orders"
                        | "payments"
                        | "operations"
                        | "settings"
                    )
                  }
                  className={`relative whitespace-nowrap px-3 py-4 text-xs font-medium ${
                    detailView === tab.id
                      ? "text-[#f5b942]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}

                  {detailView === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-px bg-[#f5b942]" />
                  )}
                </button>
              ))}
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailView === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Orders Today
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {selectedStore.orders}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Revenue Today
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#f5b942]">
                        {selectedStore.revenue}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Avg Preparation
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {selectedStore.prepTime}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Active Orders
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {selectedStore.active}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Store Actions
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <DetailAction
                        icon={ShoppingBag}
                        title="View Live Orders"
                        description="See active orders for this store."
                        onClick={() => setDetailView("orders")}
                      />

                      <DetailAction
                        icon={CreditCard}
                        title="View Payments"
                        description="See payment activity for this store."
                        onClick={() => setDetailView("payments")}
                      />

                      <DetailAction
                        icon={Activity}
                        title="View Operations"
                        description="See operational timing and activity."
                        onClick={() => setDetailView("operations")}
                      />

                      <DetailAction
                        icon={Settings}
                        title="Store Settings"
                        description="View configuration for this store."
                        onClick={() => setDetailView("settings")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {detailView === "orders" && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white">
                      Store Orders
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Current active orders at {selectedStore.name}.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                    {storeOrderSnapshot.map((order) => (
                      <div
                        key={order.order}
                        className="border-b border-white/[0.05] p-4 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#f5b942]">
                              {order.token}
                            </span>

                            <div>
                              <p className="text-sm text-white">
                                {order.order}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-600">
                                {order.items}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm text-white">
                              {order.amount}
                            </p>
                            <div className="mt-1">
                              <StatusBadge status={order.status} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailView === "payments" && (
                <div>
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-white">
                      Payment Activity
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Payment sources and transaction activity for this
                      store today.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-slate-600">
                          <th className="px-4 py-3 font-medium">
                            Source
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Orders
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Share
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {paymentRows.map((row) => (
                          <tr
                            key={row.source}
                            className="border-b border-white/[0.04] last:border-0"
                          >
                            <td className="px-4 py-3 text-sm text-white">
                              {row.source}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {row.orders}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {row.amount}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-300">
                              {row.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Refunded amount
                      </span>
                      <span className="text-sm text-white">₹240</span>
                    </div>

                    <div className="mt-3 flex justify-between">
                      <span className="text-sm text-slate-500">
                        Successful payments
                      </span>
                      <span className="text-sm text-emerald-400">
                        150
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detailView === "operations" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Operations
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Current operational timing and activity for this
                      store.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <Clock3 size={17} className="text-[#f5b942]" />
                      <p className="mt-4 text-[10px] uppercase tracking-wider text-slate-600">
                        Avg Prep Time
                      </p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {selectedStore.prepTime}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                      <Activity size={17} className="text-[#f5b942]" />
                      <p className="mt-4 text-[10px] uppercase tracking-wider text-slate-600">
                        Active Orders
                      </p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {selectedStore.active}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-[#081017] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Delayed orders
                      </span>
                      <span className="text-sm font-medium text-red-400">
                        {selectedStore.delayed}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Current status
                      </span>
                      <StatusBadge status={selectedStore.status} />
                    </div>
                  </div>
                </div>
              )}

              {detailView === "settings" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Store Settings
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Configuration and operational settings for this
                      store.
                    </p>
                  </div>

                  {[
                    {
                      label: "Store Information",
                      value: selectedStore.name,
                    },
                    {
                      label: "Location",
                      value: selectedStore.location,
                    },
                    {
                      label: "Operating Status",
                      value: selectedStore.status,
                    },
                    {
                      label: "Ordering",
                      value: "Enabled",
                    },
                    {
                      label: "QR Ordering",
                      value: "Enabled",
                    },
                    {
                      label: "Token Display",
                      value: "Connected",
                    },
                  ].map((setting) => (
                    <div
                      key={setting.label}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#081017] px-4 py-4"
                    >
                      <span className="text-sm text-slate-500">
                        {setting.label}
                      </span>

                      <span className="text-sm text-white">
                        {setting.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  IndianRupee,
  ShoppingBag,
  Timer,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type OverviewData = {
  success: boolean;

  period: {
    name: string;
    start: string;
    end: string;
  };

  filters: {
    branchId: number | "all";
  };

  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    averagePreparationTime: string;
    averageCollectionTime: string;
    storesCount: number;
  };

  liveOperations: {
    placed: number;
    preparing: number;
    ready: number;
    delayed: number;
  };

  hourlyActivity: {
    hour: number;
    orders: number;
    revenue: number;
  }[];

  stores: {
    id: number;
    name: string;
    location: string;
    orders: number;
    revenue: number;
    averagePreparationTime: string;
    delayedOrders: number;
    activeOrders: number;
  }[];

  signals: {
    type: "preparation" | "collection";
    count: number;
    message: string;
  }[];
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";

  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/*
|--------------------------------------------------------------------------
| KPI Card
|--------------------------------------------------------------------------
*/

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#081017] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Status Card
|--------------------------------------------------------------------------
*/

function StatusCard({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0a1219] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />

        <span className="text-sm text-slate-300">
          {label}
        </span>
      </div>

      <span className="text-lg font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Overview Page
|--------------------------------------------------------------------------
*/

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Fetch Overview
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
  
    const fetchOverview = async () => {
      try {
        setError("");
  
        const response = await fetch(
          `${API_URL}/api/owner/overview`,
          {
            cache: "no-store",
          }
        );
  
        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}`
          );
        }
  
        const result: OverviewData = await response.json();
  
        if (!result.success) {
          throw new Error("Failed to load overview data");
        }
  
        setData(result);
      } catch (err) {
        console.error("Overview fetch error:", err);
  
        setError(
          "Unable to load overview data from the backend."
        );
      } finally {
        setLoading(false);
      }
    };
  
    /*
    |--------------------------------------------------------------------------
    | Initial REST fetch
    |--------------------------------------------------------------------------
    */
  
    fetchOverview();
  
    /*
    |--------------------------------------------------------------------------
    | Socket.IO connection
    |--------------------------------------------------------------------------
    */
  
    socket = io(API_URL, {
      transports: ["websocket", "polling"],
    });
  
    socket.on("connect", () => {
      console.log(
        "Owner dashboard connected to Socket.IO:",
        socket?.id
      );
    });
  
    socket.on("connect_error", (error) => {
      console.error(
        "Owner dashboard Socket.IO error:",
        error.message
      );
    });
  
    /*
    |--------------------------------------------------------------------------
    | Order events
    |--------------------------------------------------------------------------
    |
    | Whenever something changes in the restaurant,
    | refresh the Overview from the database.
    |
    */
  
    const refreshOverview = () => {
      fetchOverview();
    };
  
    socket.on("NEW_ORDER", refreshOverview);
    socket.on("ORDER_STATUS_UPDATED", refreshOverview);
    socket.on("ORDER_READY", refreshOverview);
    socket.on("ORDER_COLLECTED", refreshOverview);
  
    /*
    |--------------------------------------------------------------------------
    | Existing lower-case event
    |--------------------------------------------------------------------------
    |
    | orderController also emits:
    |
    | "order-status-updated"
    |
    */
  
    socket.on(
      "order-status-updated",
      refreshOverview
    );
  
    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */
  
    return () => {
      socket?.off("NEW_ORDER", refreshOverview);
      socket?.off(
        "ORDER_STATUS_UPDATED",
        refreshOverview
      );
      socket?.off("ORDER_READY", refreshOverview);
      socket?.off(
        "ORDER_COLLECTED",
        refreshOverview
      );
      socket?.off(
        "order-status-updated",
        refreshOverview
      );
  
      socket?.disconnect();
    };
  }, []);
  /*
  |--------------------------------------------------------------------------
  | Loading State
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#f5b942]/20 border-t-[#f5b942]" />

          <p className="mt-4 text-sm text-slate-400">
            Loading overview...
          </p>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Error State
  |--------------------------------------------------------------------------
  */

  if (error || !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-xl border border-red-400/10 bg-[#081017] px-6 py-5 text-center">
          <p className="text-sm text-red-400">
            {error || "Unable to load overview."}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Check that the Yatharth backend is running.
          </p>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Activity Chart
  |--------------------------------------------------------------------------
  |
  | The backend gives us all 24 hours.
  | The current dashboard design displays the restaurant's
  | main daytime/evening window.
  |
  */

  const activityData = data.hourlyActivity
    .filter((item) => item.hour >= 10 && item.hour <= 21)
    .map((item) => ({
      time: formatHour(item.hour),
      orders: item.orders,
      revenue: item.revenue,
    }));

  const maxOrders = Math.max(
    ...activityData.map((item) => item.orders),
    1
  );

  const peakActivity = activityData.reduce(
    (peak, item) =>
      item.orders > peak.orders ? item : peak,
    activityData[0] || {
      time: "--",
      orders: 0,
      revenue: 0,
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Signals
  |--------------------------------------------------------------------------
  */

  const signals = data.signals.map((signal) => {
    if (signal.type === "preparation") {
      return {
        ...signal,
        uiType: "warning" as const,
      };
    }

    return {
      ...signal,
      uiType: "info" as const,
    };
  });

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-6">

      {/* Header */}

      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#f5b942]/75">
            Overview
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Good evening, Rohit.
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Here is what is happening across your restaurant today.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">

          <div>
            <p className="text-xs text-slate-500">
              Stores
            </p>

            <p className="mt-1 font-semibold text-white">
              {data.summary.storesCount}{" "}
              {data.summary.storesCount === 1
                ? "store"
                : "stores"}
            </p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">
              Orders today
            </p>

            <p className="mt-1 font-semibold text-white">
              {data.summary.totalOrders}
            </p>
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div>
            <p className="text-xs text-slate-500">
              Revenue today
            </p>

            <p className="mt-1 font-semibold text-[#f5b942]">
              {formatCurrency(data.summary.totalRevenue)}
            </p>
          </div>
        </div>
      </section>

      {/* KPI Cards */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <KpiCard
          title="Total Orders"
          value={data.summary.totalOrders.toString()}
          subtitle="Today"
          icon={ShoppingBag}
        />

        <KpiCard
          title="Total Revenue"
          value={formatCurrency(data.summary.totalRevenue)}
          subtitle="Today"
          icon={IndianRupee}
        />

        <KpiCard
          title="Average Order Value"
          value={formatCurrency(data.summary.averageOrderValue)}
          subtitle="Across selected stores"
          icon={WalletCards}
        />

        <KpiCard
          title="Avg Preparation Time"
          value={data.summary.averagePreparationTime}
          subtitle="From kitchen started to ready"
          icon={Timer}
        />

        <KpiCard
          title="Avg Collection Time"
          value={data.summary.averageCollectionTime}
          subtitle="From ready to collected"
          icon={Clock3}
        />

      </section>

      {/* Live Operations */}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Live Operations
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Current order status across selected stores
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />

            Live
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          <StatusCard
            label="Placed"
            value={data.liveOperations.placed}
            dot="bg-blue-400"
          />

          <StatusCard
            label="Preparing"
            value={data.liveOperations.preparing}
            dot="bg-amber-400"
          />

          <StatusCard
            label="Ready"
            value={data.liveOperations.ready}
            dot="bg-emerald-400"
          />

          <StatusCard
            label="Delayed"
            value={data.liveOperations.delayed}
            dot="bg-red-400"
          />

        </div>
      </section>

      {/* Activity + Payment */}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">

        {/* Order Activity */}

        <div className="rounded-xl border border-white/[0.07] bg-[#081017] p-5">

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Order Activity
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Orders received throughout today
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp
                size={14}
                className="text-[#f5b942]"
              />

              Peak: {peakActivity.time}
            </div>
          </div>

          <div className="mt-7 flex h-56 items-end gap-2">

            {activityData.map((item) => {
              const height =
                item.orders === 0
                  ? 4
                  : Math.max(
                      8,
                      (item.orders / maxOrders) * 100
                    );

              return (
                <div
                  key={item.time}
                  className="group flex h-full flex-1 flex-col justify-end"
                >
                  <div className="relative flex flex-1 items-end justify-center">

                    <div
                      className="w-full max-w-7 rounded-t-sm bg-[#f5b942]/75 transition-all duration-200 group-hover:bg-[#f5b942]"
                      style={{
                        height: `${height}%`,
                      }}
                    />

                    <div className="pointer-events-none absolute -top-7 rounded bg-[#121a21] px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {item.orders} orders
                    </div>

                  </div>

                  <span className="mt-3 text-center text-[9px] text-slate-600">
                    {item.time}
                  </span>
                </div>
              );
            })}

          </div>
        </div>

        {/* Payment Methods */}

        <div className="rounded-xl border border-white/[0.07] bg-[#081017] p-5">

          <div>
            <h2 className="text-base font-semibold text-white">
              Payment Methods
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Payment data will appear here once payment
              records are connected.
            </p>
          </div>

          <div className="mt-6 flex min-h-[170px] items-center justify-center rounded-lg border border-dashed border-white/[0.06]">

            <div className="text-center">
              <WalletCards
                size={24}
                className="mx-auto text-slate-600"
              />

              <p className="mt-3 text-sm text-slate-400">
                Payment data unavailable
              </p>

              <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-slate-600">
                This section will connect to the Razorpay
                payment data after the payment backend is
                integrated.
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* Store Performance */}

      <section className="rounded-xl border border-white/[0.07] bg-[#081017]">

        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">

          <div>
            <h2 className="text-base font-semibold text-white">
              Store Performance
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Today&apos;s operational snapshot by store
            </p>
          </div>

          <span className="text-[11px] text-slate-500">
            {data.summary.storesCount}{" "}
            {data.summary.storesCount === 1
              ? "store"
              : "stores"}
          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[700px] text-left">

            <thead>
              <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-slate-600">

                <th className="px-5 py-3 font-medium">
                  Store
                </th>

                <th className="px-5 py-3 font-medium">
                  Orders
                </th>

                <th className="px-5 py-3 font-medium">
                  Revenue
                </th>

                <th className="px-5 py-3 font-medium">
                  Avg Prep Time
                </th>

                <th className="px-5 py-3 font-medium">
                  Active
                </th>

                <th className="px-5 py-3 text-right font-medium">
                  Delayed
                </th>

              </tr>
            </thead>

            <tbody>

              {data.stores.map((store) => (
                <tr
                  key={store.id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015]"
                >

                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {store.name}
                      </p>

                      <p className="mt-0.5 text-[10px] text-slate-600">
                        {store.location}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.orders}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {formatCurrency(store.revenue)}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.averagePreparationTime}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-300">
                    {store.activeOrders}
                  </td>

                  <td className="px-5 py-4 text-right">

                    <span
                      className={
                        store.delayedOrders > 0
                          ? "text-sm font-medium text-red-400"
                          : "text-sm text-slate-500"
                      }
                    >
                      {store.delayedOrders}
                    </span>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* Operational Signals */}

      <section>

        <div className="mb-3">

          <h2 className="text-base font-semibold text-white">
            Operational Signals
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Recent events and activity worth seeing
          </p>

        </div>

        {signals.length === 0 ? (
          <div className="rounded-lg border border-white/[0.06] bg-[#081017] px-4 py-5">

            <p className="text-sm text-slate-400">
              No operational signals right now.
            </p>

          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

            {signals.map((signal) => {

              const styles = {
                warning: {
                  border: "border-amber-400/10",
                  dot: "bg-amber-400",
                  icon: ArrowUpRight,
                },

                info: {
                  border: "border-blue-400/10",
                  dot: "bg-blue-400",
                  icon: Clock3,
                },
              }[signal.uiType];

              const Icon = styles.icon;

              return (
                <div
                  key={signal.message}
                  className={`flex items-center gap-3 rounded-lg border ${styles.border} bg-[#081017] px-4 py-3.5`}
                >

                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
                  />

                  <p className="flex-1 text-sm text-slate-300">
                    {signal.message}
                  </p>

                  <Icon
                    size={15}
                    className="shrink-0 text-slate-600"
                  />

                </div>
              );
            })}

          </div>
        )}

      </section>

    </div>
  );
}
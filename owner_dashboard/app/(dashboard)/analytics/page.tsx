"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const hourlyOrders = [
  { time: "10 AM", value: 24 },
  { time: "11 AM", value: 31 },
  { time: "12 PM", value: 38 },
  { time: "1 PM", value: 34 },
  { time: "2 PM", value: 27 },
  { time: "3 PM", value: 21 },
  { time: "4 PM", value: 29 },
  { time: "5 PM", value: 36 },
  { time: "6 PM", value: 44 },
  { time: "7 PM", value: 52 },
  { time: "8 PM", value: 48 },
  { time: "9 PM", value: 32 },
];

const storeData = [
  {
    store: "Indore 1",
    orders: 152,
    revenue: "₹18,240",
    preparation: "7m 42s",
    delayed: 1,
  },
  {
    store: "Indore 2",
    orders: 139,
    revenue: "₹16,680",
    preparation: "8m 31s",
    delayed: 2,
  },
  {
    store: "Indore 3",
    orders: 91,
    revenue: "₹10,920",
    preparation: "9m 14s",
    delayed: 0,
  },
  {
    store: "Indore 4",
    orders: 46,
    revenue: "₹5,520",
    preparation: "10m 02s",
    delayed: 0,
  },
];

const paymentData = [
  { method: "UPI", orders: 190, amount: "₹23,112", share: 45 },
  { method: "Card", orders: 118, amount: "₹14,371", share: 28 },
  { method: "Cash", orders: 76, amount: "₹9,245", share: 18 },
  { method: "Other", orders: 39, amount: "₹4,632", share: 9 },
];

export default function AnalyticsPage() {
  const maxOrders = Math.max(...hourlyOrders.map((item) => item.value));

  return (
    <div className="space-y-7">
      {/* Header */}
      <section>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f5b942]">
              Analytics
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Restaurant Analytics
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Understand patterns across sales, orders, operations and stores.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#081017] px-4 text-sm text-slate-200 transition hover:border-white/[0.14] hover:bg-white/[0.03]"
            >
              <CalendarDays size={16} className="text-slate-400" />
              Today
              <ChevronDown size={15} className="text-slate-500" />
            </button>

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-lg border border-[#f5b942]/30 bg-[#2a1d0b] px-4 text-sm text-[#f5b942]"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              All Stores
              <ChevronDown size={15} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
          <span>Compared with previous day</span>
          <span className="text-slate-700">•</span>
          <span>Data updated just now</span>
        </div>
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Revenue"
          value="₹51,360"
          comparison="+8.4%"
          positive
          icon={<TrendingUp size={18} />}
        />

        <MetricCard
          label="Total Orders"
          value="428"
          comparison="+6.2%"
          positive
          icon={<ShoppingBag size={18} />}
        />

        <MetricCard
          label="Average Order Value"
          value="₹120"
          comparison="+2.1%"
          positive
          icon={<BarChart3 size={18} />}
        />

        <MetricCard
          label="Avg Preparation Time"
          value="8m 24s"
          comparison="-4.8%"
          positive
          icon={<Clock3 size={18} />}
        />
      </section>

      {/* Sales & Orders */}
      <section className="grid grid-cols-[1.7fr_1fr] gap-5">
        {/* Order activity */}
        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Order Activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Orders received throughout the selected period.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">Peak</div>
              <div className="mt-1 text-sm font-medium text-[#f5b942]">
                7 PM · 52 orders
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-7">
            <div className="flex h-64 items-end gap-3">
              {hourlyOrders.map((item) => {
                const height = (item.value / maxOrders) * 100;

                return (
                  <div
                    key={item.time}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                  >
                    <div className="text-[10px] text-slate-500">
                      {item.value}
                    </div>

                    <div className="flex h-[190px] w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-[#f5b942]/80 transition-all hover:bg-[#f5b942]"
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <div className="text-[10px] text-slate-600">
                      {item.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Revenue summary */}
        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <h2 className="text-base font-semibold text-white">
              Sales & Revenue
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Revenue information for the selected period.
            </p>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Revenue
              </div>
              <div className="mt-2 text-3xl font-semibold text-[#f5b942]">
                ₹51,360
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                <TrendingUp size={13} />
                8.4% compared with previous day
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Average order value
                </span>
                <span className="text-sm font-medium text-white">₹120</span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Orders
                </span>
                <span className="text-sm font-medium text-white">428</span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Refunded amount
                </span>
                <span className="text-sm font-medium text-white">₹240</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operations */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">
            Operations
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Timing and order-flow data across the restaurant.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <OperationalCard
            icon={<Clock3 size={18} />}
            label="Average Preparation"
            value="8m 24s"
            detail="Kitchen received → Ready"
            comparison="-4.8%"
            positive
          />

          <OperationalCard
            icon={<Clock3 size={18} />}
            label="Average Collection"
            value="2m 11s"
            detail="Ready → Collected"
            comparison="+1.6%"
            positive={false}
          />

          <OperationalCard
            icon={<TrendingDown size={18} />}
            label="Delayed Orders"
            value="3"
            detail="Orders currently above threshold"
            comparison="-2 orders"
            positive
          />
        </div>
      </section>

      {/* Store Analytics */}
      <section className="rounded-xl border border-white/[0.08] bg-[#081017]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Store Analytics
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Operational and sales data by store.
            </p>
          </div>

          <Store size={18} className="text-slate-500" />
        </div>

        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Store
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Orders
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Revenue
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Avg Prep
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Delayed
                </th>
              </tr>
            </thead>

            <tbody>
              {storeData.map((store) => (
                <tr
                  key={store.store}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {store.store}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-300">
                    {store.orders}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-300">
                    {store.revenue}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-300">
                    {store.preparation}
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <span
                      className={
                        store.delayed > 0
                          ? "text-red-400"
                          : "text-slate-500"
                      }
                    >
                      {store.delayed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payments */}
      <section className="grid grid-cols-[1.35fr_1fr] gap-5">
        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-[#f5b942]" />

              <div>
                <h2 className="text-base font-semibold text-white">
                  Payment Analytics
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Successful payment distribution.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {paymentData.map((payment) => (
              <div key={payment.method}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {payment.method}
                  </span>

                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">
                      {payment.amount}
                    </span>

                    <span className="text-sm font-medium text-white">
                      {payment.share}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#18222b]">
                  <div
                    className="h-full rounded-full bg-[#f5b942]"
                    style={{ width: `${payment.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data signals */}
        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <h2 className="text-base font-semibold text-white">
              Observed Patterns
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Notable data from the selected period.
            </p>
          </div>

          <div className="divide-y divide-white/[0.06]">
            <PatternRow
              title="Peak order period"
              value="7 PM"
              detail="52 orders"
            />

            <PatternRow
              title="Highest revenue store"
              value="Indore 1"
              detail="₹18,240"
            />

            <PatternRow
              title="Most used payment"
              value="UPI"
              detail="45% of successful payments"
            />

            <PatternRow
              title="Orders above 10 min"
              value="5"
              detail="During the last hour"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  comparison,
  positive,
  icon,
}: {
  label: string;
  value: string;
  comparison: string;
  positive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#081017] p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs text-slate-500">{label}</span>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
          {icon}
        </div>
      </div>

      <div className="mt-5 text-2xl font-semibold text-white">
        {value}
      </div>

      <div
        className={`mt-2 flex items-center gap-1 text-xs ${
          positive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {positive ? (
          <TrendingUp size={12} />
        ) : (
          <TrendingDown size={12} />
        )}

        {comparison}
      </div>
    </div>
  );
}

function OperationalCard({
  icon,
  label,
  value,
  detail,
  comparison,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  comparison: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#081017] p-5">
      <div className="flex items-center gap-3 text-[#f5b942]">
        {icon}

        <span className="text-xs uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>

      <div className="mt-5 text-2xl font-semibold text-white">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-600">
        {detail}
      </div>

      <div
        className={`mt-4 text-xs ${
          positive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {comparison} vs previous day
      </div>
    </div>
  );
}

function PatternRow({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="text-sm text-slate-300">{title}</div>
        <div className="mt-1 text-xs text-slate-600">{detail}</div>
      </div>

      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}
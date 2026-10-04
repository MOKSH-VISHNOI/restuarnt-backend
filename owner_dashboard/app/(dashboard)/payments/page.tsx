"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  Search,
  X,
  XCircle,
} from "lucide-react";

type PaymentStatus = "Paid" | "Failed" | "Refunded";
type PaymentMethod = "UPI" | "Card" | "Cash" | "Other";

interface Payment {
  id: string;
  orderId: string;
  store: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  time: string;
  paymentId: string;
}

const payments: Payment[] = [
  {
    id: "1",
    orderId: "ORD-10428",
    store: "Indore 1",
    method: "UPI",
    amount: 240,
    status: "Paid",
    time: "9:18 PM",
    paymentId: "pay_RZP48291",
  },
  {
    id: "2",
    orderId: "ORD-10426",
    store: "Indore 1",
    method: "UPI",
    amount: 220,
    status: "Paid",
    time: "9:21 PM",
    paymentId: "pay_RZP48284",
  },
  {
    id: "3",
    orderId: "ORD-10422",
    store: "Indore 2",
    method: "Card",
    amount: 120,
    status: "Paid",
    time: "9:16 PM",
    paymentId: "pay_RZP48271",
  },
  {
    id: "4",
    orderId: "ORD-10419",
    store: "Indore 3",
    method: "Cash",
    amount: 180,
    status: "Paid",
    time: "9:12 PM",
    paymentId: "CASH-10419",
  },
  {
    id: "5",
    orderId: "ORD-10417",
    store: "Indore 2",
    method: "Card",
    amount: 260,
    status: "Failed",
    time: "9:08 PM",
    paymentId: "pay_RZP48263",
  },
  {
    id: "6",
    orderId: "ORD-10412",
    store: "Indore 4",
    method: "UPI",
    amount: 140,
    status: "Refunded",
    time: "8:56 PM",
    paymentId: "pay_RZP48241",
  },
  {
    id: "7",
    orderId: "ORD-10408",
    store: "Indore 1",
    method: "UPI",
    amount: 320,
    status: "Paid",
    time: "8:49 PM",
    paymentId: "pay_RZP48229",
  },
];

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("All Stores");
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedPayment, setSelectedPayment] =
    useState<Payment | null>(null);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch =
        payment.orderId.toLowerCase().includes(search.toLowerCase()) ||
        payment.store.toLowerCase().includes(search.toLowerCase()) ||
        payment.paymentId.toLowerCase().includes(search.toLowerCase());

      const matchesStore =
        storeFilter === "All Stores" ||
        payment.store === storeFilter;

      const matchesMethod =
        methodFilter === "All Methods" ||
        payment.method === methodFilter;

      const matchesStatus =
        statusFilter === "All Status" ||
        payment.status === statusFilter;

      return (
        matchesSearch &&
        matchesStore &&
        matchesMethod &&
        matchesStatus
      );
    });
  }, [search, storeFilter, methodFilter, statusFilter]);

  const statusClass = (status: PaymentStatus) => {
    if (status === "Paid") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
    }

    if (status === "Failed") {
      return "border-red-500/20 bg-red-500/10 text-red-400";
    }

    return "border-amber-500/20 bg-amber-500/10 text-amber-400";
  };

  return (
    <div className="relative min-h-full">
      {/* Header */}
      <section>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f5b942]">
          Payment Management
        </div>

        <div className="mt-2 flex items-end justify-between gap-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Payments
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Monitor payment activity across your restaurant.
            </p>
          </div>

          <div className="flex items-center gap-7">
            <div>
              <div className="text-xs text-slate-500">
                Successful
              </div>
              <div className="mt-1 text-lg font-semibold text-emerald-400">
                423
              </div>
            </div>

            <div className="h-9 w-px bg-white/10" />

            <div>
              <div className="text-xs text-slate-500">
                Failed
              </div>
              <div className="mt-1 text-lg font-semibold text-red-400">
                4
              </div>
            </div>

            <div className="h-9 w-px bg-white/10" />

            <div>
              <div className="text-xs text-slate-500">
                Refunded
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                2
              </div>
            </div>

            <div className="h-9 w-px bg-white/10" />

            <div>
              <div className="text-xs text-slate-500">
                Payment Value
              </div>
              <div className="mt-1 text-lg font-semibold text-[#f5b942]">
                ₹51,360
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="mt-7 grid grid-cols-4 gap-4">
        <SummaryCard
          label="Successful Payments"
          value="423"
          helper="Today's successful transactions"
          icon={<CheckCircle2 size={19} />}
          iconClass="text-emerald-400"
        />

        <SummaryCard
          label="Failed Payments"
          value="4"
          helper="Today's failed attempts"
          icon={<XCircle size={19} />}
          iconClass="text-red-400"
        />

        <SummaryCard
          label="Refunded"
          value="2"
          helper="Today's refunded payments"
          icon={<Clock3 size={19} />}
          iconClass="text-amber-400"
        />

        <SummaryCard
          label="Average Payment"
          value="₹120"
          helper="Across successful payments"
          icon={<CreditCard size={19} />}
          iconClass="text-[#f5b942]"
        />
      </section>

      {/* Payment Methods */}
      <section className="mt-6 grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <h2 className="text-base font-semibold text-white">
              Payment Methods
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Today's successful payment distribution
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <PaymentMethodBar
              name="UPI"
              percentage={45}
              amount="₹23,112"
            />

            <PaymentMethodBar
              name="Card"
              percentage={28}
              amount="₹14,371"
            />

            <PaymentMethodBar
              name="Cash"
              percentage={18}
              amount="₹9,245"
            />

            <PaymentMethodBar
              name="Other"
              percentage={9}
              amount="₹4,632"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#081017]">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <h2 className="text-base font-semibold text-white">
              Payment Status
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Today's transaction status
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <StatusRow
              label="Successful"
              value="423"
              percentage="98.6%"
              className="text-emerald-400"
            />

            <StatusRow
              label="Failed"
              value="4"
              percentage="0.9%"
              className="text-red-400"
            />

            <StatusRow
              label="Refunded"
              value="2"
              percentage="0.5%"
              className="text-amber-400"
            />
          </div>
        </div>
      </section>

      {/* Transactions */}
      <section className="mt-6 rounded-xl border border-white/[0.08] bg-[#081017]">
        <div className="border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Payment Transactions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Recent payment activity across all stores.
              </p>
            </div>

            <span className="text-xs text-slate-500">
              {filteredPayments.length} transactions
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 border-b border-white/[0.07] px-6 py-4">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order or payment ID..."
              className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#05090d] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#f5b942]/50"
            />
          </div>

          <FilterButton
            value={storeFilter}
            options={[
              "All Stores",
              "Indore 1",
              "Indore 2",
              "Indore 3",
              "Indore 4",
            ]}
            onChange={setStoreFilter}
          />

          <FilterButton
            value={methodFilter}
            options={[
              "All Methods",
              "UPI",
              "Card",
              "Cash",
              "Other",
            ]}
            onChange={setMethodFilter}
          />

          <FilterButton
            value={statusFilter}
            options={[
              "All Status",
              "Paid",
              "Failed",
              "Refunded",
            ]}
            onChange={setStatusFilter}
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07] text-left">
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Order
                </th>

                <th className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Store
                </th>

                <th className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Method
                </th>

                <th className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Amount
                </th>

                <th className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-4 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Time
                </th>

                <th className="px-6 py-4 text-right text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.015]"
                >
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-white">
                      {payment.orderId}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-600">
                      {payment.paymentId}
                    </div>
                  </td>

                  <td className="px-4 py-5 text-sm text-slate-300">
                    {payment.store}
                  </td>

                  <td className="px-4 py-5 text-sm text-slate-300">
                    {payment.method}
                  </td>

                  <td className="px-4 py-5 text-sm font-medium text-white">
                    ₹{payment.amount}
                  </td>

                  <td className="px-4 py-5">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${statusClass(
                        payment.status
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </td>

                  <td className="px-4 py-5 text-sm text-slate-400">
                    {payment.time}
                  </td>

                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-[#f5b942]/30 hover:text-[#f5b942]"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPayments.length === 0 && (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No payment transactions found.
            </div>
          )}
        </div>
      </section>

      {/* Payment Drawer */}
      {selectedPayment && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedPayment(null)}
          />

          <aside className="absolute right-0 top-0 h-full w-[460px] overflow-y-auto border-l border-white/[0.08] bg-[#05090d] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] px-7 py-6">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#f5b942]">
                  Payment Details
                </div>

                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedPayment.orderId}
                </h2>
              </div>

              <button
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={21} />
              </button>
            </div>

            <div className="space-y-7 px-7 py-7">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Payment Information
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#081017]">
                  <DetailRow
                    label="Order"
                    value={selectedPayment.orderId}
                  />

                  <DetailRow
                    label="Store"
                    value={selectedPayment.store}
                  />

                  <DetailRow
                    label="Method"
                    value={selectedPayment.method}
                  />

                  <DetailRow
                    label="Amount"
                    value={`₹${selectedPayment.amount}`}
                  />

                  <DetailRow
                    label="Status"
                    value={selectedPayment.status}
                    valueClass={
                      selectedPayment.status === "Paid"
                        ? "text-emerald-400"
                        : selectedPayment.status === "Failed"
                        ? "text-red-400"
                        : "text-amber-400"
                    }
                  />

                  <DetailRow
                    label="Payment ID"
                    value={selectedPayment.paymentId}
                  />

                  <DetailRow
                    label="Paid at"
                    value={selectedPayment.time}
                    last
                  />
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Transaction
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#081017] p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        selectedPayment.status === "Paid"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : selectedPayment.status === "Failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {selectedPayment.status === "Paid" ? (
                        <CheckCircle2 size={19} />
                      ) : selectedPayment.status === "Failed" ? (
                        <XCircle size={19} />
                      ) : (
                        <Clock3 size={19} />
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-white">
                        {selectedPayment.status}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Transaction recorded at {selectedPayment.time}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#081017] p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs text-slate-500">{label}</div>

        <div className={`rounded-lg bg-[#2a1d0b] p-2 ${iconClass}`}>
          {icon}
        </div>
      </div>

      <div className="mt-5 text-2xl font-semibold text-white">
        {value}
      </div>

      <div className="mt-2 text-[11px] text-slate-600">
        {helper}
      </div>
    </div>
  );
}

function PaymentMethodBar({
  name,
  percentage,
  amount,
}: {
  name: string;
  percentage: number;
  amount: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{name}</span>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">
            {amount}
          </span>

          <span className="font-medium text-white">
            {percentage}%
          </span>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#151e25]">
        <div
          className="h-full rounded-full bg-[#f5b942]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  percentage,
  className,
}: {
  label: string;
  value: string;
  percentage: string;
  className: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full bg-current ${className}`} />
        <span className="text-sm text-slate-300">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <span className="text-sm font-medium text-white">
          {value}
        </span>

        <span className="w-12 text-right text-xs text-slate-500">
          {percentage}
        </span>
      </div>
    </div>
  );
}

function FilterButton({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-lg border border-white/[0.08] bg-[#05090d] pl-4 pr-9 text-xs text-slate-300 outline-none focus:border-[#f5b942]/50"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>

      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass = "text-white",
  last = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-4 ${
        !last ? "border-b border-white/[0.06]" : ""
      }`}
    >
      <span className="text-sm text-slate-500">{label}</span>

      <span
        className={`max-w-[230px] truncate text-right text-sm font-medium ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}
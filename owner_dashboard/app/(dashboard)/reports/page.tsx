"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Filter,
  Package,
  RefreshCw,
  Store,
} from "lucide-react";

const reportGroups = [
  {
    title: "Sales",
    description: "Revenue and sales records.",
    icon: BarChart3,
    reports: [
      {
        name: "Daily Sales Report",
        description: "Revenue, orders and average order value.",
      },
      {
        name: "Sales Summary",
        description: "Sales summary for the selected period.",
      },
    ],
  },
  {
    title: "Orders",
    description: "Order records and order activity.",
    icon: Package,
    reports: [
      {
        name: "Order History",
        description: "Complete order records for the selected period.",
      },
      {
        name: "Order Summary",
        description: "Order counts grouped by status and store.",
      },
    ],
  },
  {
    title: "Kitchen & Operations",
    description: "Operational timing and activity records.",
    icon: Clock3,
    reports: [
      {
        name: "Preparation Time Report",
        description: "Preparation timing across stores.",
      },
      {
        name: "Delayed Orders Report",
        description: "Orders that exceeded the configured threshold.",
      },
    ],
  },
  {
    title: "Payments",
    description: "Payment transactions and status records.",
    icon: CreditCard,
    reports: [
      {
        name: "Payment Report",
        description: "Payment transactions by method and status.",
      },
      {
        name: "Refund Report",
        description: "Refunded payment records.",
      },
    ],
  },
  {
    title: "Stores",
    description: "Store-level operational records.",
    icon: Store,
    reports: [
      {
        name: "Store Performance Report",
        description: "Daily operational data by store.",
      },
      {
        name: "Store Activity Report",
        description: "Order and activity records by store.",
      },
    ],
  },
];

const recentReports = [
  {
    name: "Daily Sales Report",
    period: "Today",
    generated: "9:12 PM",
    format: "PDF",
  },
  {
    name: "Order History",
    period: "01 Oct – 03 Oct",
    generated: "8:46 PM",
    format: "CSV",
  },
  {
    name: "Payment Report",
    period: "01 Oct – 03 Oct",
    generated: "7:31 PM",
    format: "PDF",
  },
  {
    name: "Store Performance Report",
    period: "September 2026",
    generated: "Yesterday",
    format: "PDF",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-7">
      {/* Header */}
      <section>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f5b942]">
              Reporting
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Reports
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Generate and access operational, sales and payment records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#081017] px-4 text-sm text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.03]"
            >
              <CalendarDays size={16} className="text-slate-500" />
              Today
              <ChevronDown size={15} className="text-slate-500" />
            </button>

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-lg border border-[#f5b942]/30 bg-[#2a1d0b] px-4 text-sm text-[#f5b942] transition hover:bg-[#35250d]"
            >
              <Store size={16} />
              All Stores
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Report generator */}
      <section className="rounded-xl border border-white/[0.08] bg-[#081017]">
        <div className="border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
              <FileText size={18} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white">
                Generate Report
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Select a report and configure the period before generating.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 p-6">
          <ReportSelect
            label="Report"
            value="Daily Sales Report"
          />

          <ReportSelect
            label="Period"
            value="Today"
            icon={<CalendarDays size={15} />}
          />

          <ReportSelect
            label="Store"
            value="All Stores"
            icon={<Store size={15} />}
          />

          <button
            type="button"
            className="mt-[22px] flex h-11 items-center justify-center gap-2 rounded-lg bg-[#f5b942] px-6 text-sm font-semibold text-[#171108] transition hover:bg-[#ffd36a]"
          >
            <FileText size={16} />
            Generate
          </button>
        </div>
      </section>

      {/* Report categories */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Report Library
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Reports organized by the type of information they contain.
            </p>
          </div>

          <button
            type="button"
            className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
          >
            <Filter size={14} />
            Filters
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {reportGroups.map((group) => {
            const Icon = group.icon;

            return (
              <div
                key={group.title}
                className="rounded-xl border border-white/[0.08] bg-[#081017]"
              >
                <div className="flex items-start gap-4 border-b border-white/[0.07] px-5 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
                    <Icon size={19} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {group.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {group.reports.map((report) => (
                    <button
                      key={report.name}
                      type="button"
                      className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/[0.025]"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {report.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {report.description}
                        </div>
                      </div>

                      <Download
                        size={16}
                        className="text-slate-600 transition group-hover:text-[#f5b942]"
                      />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent reports */}
      <section className="rounded-xl border border-white/[0.08] bg-[#081017]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Recent Reports
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Recently generated reports.
            </p>
          </div>

          <button
            type="button"
            className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Report
                </th>

                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Period
                </th>

                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Generated
                </th>

                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Format
                </th>

                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {recentReports.map((report) => (
                <tr
                  key={`${report.name}-${report.generated}`}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#111a22] text-slate-400">
                        <FileText size={15} />
                      </div>

                      <span className="text-sm font-medium text-slate-200">
                        {report.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-400">
                    {report.period}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-500">
                    {report.generated}
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] font-medium text-slate-400">
                      {report.format}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-xs text-slate-300 transition hover:border-[#f5b942]/30 hover:text-[#f5b942]"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReportSelect({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="text-left"
    >
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="flex h-11 items-center justify-between rounded-lg border border-white/[0.08] bg-[#0b141c] px-3 text-sm text-slate-200 transition hover:border-white/[0.14]">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          {value}
        </div>

        <ChevronDown size={15} className="text-slate-500" />
      </div>
    </button>
  );
}
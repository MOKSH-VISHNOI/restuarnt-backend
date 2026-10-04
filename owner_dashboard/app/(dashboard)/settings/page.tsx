"use client";

import {
    Bell,
    ChevronRight,
    Clock3,
    CreditCard,
    KeyRound,
    Lock,
    Monitor,
    QrCode,
    Settings2,
    ShieldCheck,
    Store,
    UserRound,
    Users,
    Workflow,
  } from "lucide-react";
const settingGroups = [
  {
    title: "Account",
    description: "Manage your account and dashboard preferences.",
    items: [
      {
        title: "Profile",
        description: "Name, email and account information.",
        icon: UserRound,
      },
      {
        title: "Business Account",
        description: "Restaurant business details.",
        icon: Store,
      },
      {
        title: "Preferences",
        description: "Dashboard and display preferences.",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Stores",
    description: "Configure individual store information.",
    items: [
      {
        title: "Store Information",
        description: "Name, address and contact details.",
        icon: Store,
      },
      {
        title: "Operating Hours",
        description: "Opening and closing hours for each store.",
        icon: Clock3,
      },
      {
        title: "Ordering Availability",
        description: "Control when customer ordering is available.",
        icon: QrCode,
      },
    ],
  },
  {
    title: "Ordering",
    description: "Configure the customer ordering experience.",
    items: [
      {
        title: "QR Ordering",
        description: "QR codes and ordering access.",
        icon: QrCode,
      },
      {
        title: "Order Rules",
        description: "Configure order behaviour and timing.",
        icon: Workflow,
      },
      {
        title: "Customer Ordering",
        description: "Customer-facing ordering settings.",
        icon: UserRound,
      },
      {
        title: "Order Sources",
        description: "Manage supported order sources.",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Kitchen & Operations",
    description: "Configure how orders move through the restaurant.",
    items: [
      {
        title: "Workflow",
        description: "Order status and operational workflow.",
        icon: Workflow,
      },
      {
        title: "Kitchen Display",
        description: "Configure kitchen display behaviour.",
        icon: Monitor,
      },
      {
        title: "Order Routing",
        description: "Control where orders are sent.",
        icon: Workflow,
      },
      {
        title: "Token Configuration",
        description: "Configure token numbering behaviour.",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Displays",
    description: "Configure restaurant-facing displays.",
    items: [
      {
        title: "Public Display",
        description: "Ready-token and customer display settings.",
        icon: Monitor,
      },
      {
        title: "Kitchen Display",
        description: "Kitchen screen configuration.",
        icon: Monitor,
      },
      {
        title: "Counter Display",
        description: "Counter screen configuration.",
        icon: Monitor,
      },
    ],
  },
  {
    title: "Payments & Integrations",
    description: "Manage payment and connected services.",
    items: [
      {
        title: "Razorpay",
        description: "Payment gateway connection.",
        icon: CreditCard,
      },
      {
        title: "Payment Settings",
        description: "Payment behaviour and configuration.",
        icon: CreditCard,
      },
      {
        title: "Integrations",
        description: "Connected external services.",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Notifications",
    description: "Configure system and order notifications.",
    items: [
      {
        title: "Order Notifications",
        description: "Order status notification settings.",
        icon: Bell,
      },
      {
        title: "Payment Notifications",
        description: "Payment-related notifications.",
        icon: Bell,
      },
      {
        title: "System Notifications",
        description: "System and operational alerts.",
        icon: Bell,
      },
    ],
  },
  {
    title: "Users & Access",
    description: "Control users, roles and store access.",
    items: [
      {
        title: "Users",
        description: "Manage dashboard users.",
        icon: Users,
      },
      {
        title: "Roles",
        description: "Configure user roles and permissions.",
        icon: ShieldCheck,
      },
      {
        title: "Store Access",
        description: "Control which stores users can access.",
        icon: Store,
      },
    ],
  },
  {
    title: "Security",
    description: "Manage account security and sessions.",
    items: [
      {
        title: "Password",
        description: "Change your account password.",
        icon: KeyRound,
      },
      {
        title: "Two-Factor Authentication",
        description: "Add an additional authentication layer.",
        icon: ShieldCheck,
      },
      {
        title: "Sessions",
        description: "View active account sessions.",
        icon: Lock,
      },
      {
        title: "Security Activity",
        description: "Review recent security activity.",
        icon: ShieldCheck,
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      {/* Header */}
      <section>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f5b942]">
          Configuration
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Settings
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Configure how Yatharth operates across your restaurant.
        </p>
      </section>

      {/* Main layout */}
      <div className="grid grid-cols-[230px_1fr] gap-6">
        {/* Settings navigation */}
        <aside className="h-fit rounded-xl border border-white/[0.08] bg-[#081017] p-3">
          <SettingsNavItem
            label="Account"
            active
          />

          <SettingsNavItem label="Stores" />

          <SettingsNavItem label="Ordering" />

          <SettingsNavItem label="Kitchen & Operations" />

          <SettingsNavItem label="Displays" />

          <SettingsNavItem label="Payments & Integrations" />

          <SettingsNavItem label="Notifications" />

          <SettingsNavItem label="Users & Access" />

          <SettingsNavItem label="Security" />
        </aside>

        {/* Settings content */}
        <main className="space-y-5">
          {settingGroups.map((group) => (
            <section
              key={group.title}
              className="rounded-xl border border-white/[0.08] bg-[#081017]"
            >
              <div className="border-b border-white/[0.07] px-6 py-5">
                <h2 className="text-base font-semibold text-white">
                  {group.title}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {group.description}
                </p>
              </div>

              <div className="grid grid-cols-2">
                {group.items.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.title}
                      type="button"
                      className={`group flex items-center justify-between px-6 py-5 text-left transition hover:bg-white/[0.025] ${
                        index < group.items.length - 2
                          ? "border-b border-white/[0.06]"
                          : ""
                      } ${
                        index % 2 === 0
                          ? "border-r border-white/[0.06]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111a22] text-slate-400 transition group-hover:bg-[#2a1d0b] group-hover:text-[#f5b942]">
                          <Icon size={17} strokeWidth={1.8} />
                        </div>

                        <div>
                          <div className="text-sm font-medium text-slate-200">
                            {item.title}
                          </div>

                          <div className="mt-1 text-xs text-slate-600">
                            {item.description}
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className="shrink-0 text-slate-700 transition group-hover:text-[#f5b942]"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Configuration note */}
          <section className="rounded-xl border border-[#f5b942]/15 bg-[#0c1115] px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a1d0b] text-[#f5b942]">
                <Settings2 size={17} />
              </div>

              <div>
                <div className="text-sm font-medium text-slate-200">
                  Configuration changes
                </div>

                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  Changes made here can affect how orders, displays,
                  payments and store operations work across Yatharth.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SettingsNavItem({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mb-1 flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-medium transition ${
        active
          ? "bg-[#2a1d0b] text-[#f5b942]"
          : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
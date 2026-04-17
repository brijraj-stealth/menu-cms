"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  UtensilsCrossed, Building2, BookOpen, Users, AlertCircle, LogOut, History, Shield, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { label: "Menus", href: "/dashboard", icon: BookOpen, exact: true },
  { label: "Properties", href: "/dashboard/properties", icon: Building2, exact: false },
  { label: "Users", href: "/dashboard/users", icon: Users, exact: false },
  { label: "Allergens", href: "/dashboard/allergens", icon: AlertCircle, exact: false },
];

const systemNavItems = [
  { label: "Audit log", href: "/dashboard/audit-log", icon: History, exact: false },
  { label: "Roles & permissions", href: "/dashboard/users", icon: Shield, exact: false },
  { label: "Archived", href: "/dashboard/archived", icon: Archive, exact: false },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isStaff = user.role === "STAFF";

  const visibleMain = isStaff
    ? mainNavItems.filter((item) => item.href !== "/dashboard/users")
    : mainNavItems;

  const visibleSystem = isStaff
    ? [] // staff can't see system section
    : systemNavItems;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200/80 bg-[#FAFAFA]">
      {/* Brand */}
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-neutral-900">
          <UtensilsCrossed className="size-3.5 text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-neutral-800">
          Menuboard
        </span>
      </div>

      {/* Main Nav */}
      <nav className="flex flex-col gap-px px-2 py-1">
        {visibleMain.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href) && (href !== "/dashboard/users" || pathname.startsWith("/dashboard/users"));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
                isActive
                  ? "bg-neutral-200/70 text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* System section */}
      {visibleSystem.length > 0 && (
        <div className="mt-auto px-2 pb-1">
          <p className="mb-1 px-2.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            System
          </p>
          <div className="flex flex-col gap-px">
            {visibleSystem.map(({ label, href, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={`${href}-${label}`}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
                    isActive
                      ? "bg-neutral-200/70 text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User */}
      <div className={cn("border-t border-neutral-200/80 px-2 py-2", !isStaff && "mt-0")}>
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-[10px] font-bold uppercase text-neutral-600 select-none">
            {user.name?.[0] ?? user.email?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            {user.name && (
              <p className="truncate text-[12px] font-medium leading-tight text-neutral-700">
                {user.name}
              </p>
            )}
            <p className="truncate text-[11px] leading-tight text-neutral-400">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-neutral-400 transition-colors duration-100 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <LogOut className="size-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

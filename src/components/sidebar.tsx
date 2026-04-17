"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  UtensilsCrossed,
  Building2,
  Users,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Properties", href: "/dashboard", icon: Building2 },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Allergens", href: "/dashboard/allergens", icon: AlertCircle },
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

  const visibleItems = isStaff
    ? navItems.filter((item) => item.href !== "/dashboard/users")
    : navItems;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200/80 bg-[#FAFAFA]">
      {/* Brand */}
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-neutral-900">
          <UtensilsCrossed className="size-3.5 text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-neutral-800">
          Menu CMS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-px px-2 py-1">
        {visibleItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/dashboard/properties")
              : pathname.startsWith(href);

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
              <Icon className="size-3.75 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="mt-auto border-t border-neutral-200/80 px-2 py-2">
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

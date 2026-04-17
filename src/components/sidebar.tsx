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
    <aside className="flex w-65 shrink-0 flex-col bg-slate-900 text-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-white/10">
          <UtensilsCrossed className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Menu CMS</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3">
        {visibleItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="mt-auto border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold uppercase">
            {user.name?.[0] ?? user.email?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            {user.name && (
              <p className="truncate text-sm font-medium">{user.name}</p>
            )}
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

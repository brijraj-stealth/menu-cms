"use client";

import { useEffect, useState } from "react";
import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogUser {
  id: string;
  name: string | null;
  email: string;
}

interface Change {
  field: string;
  old: string | number | boolean | null;
  new: string | number | boolean | null;
}

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: {
    entityName?: string;
    changes?: Change[];
  } | null;
  createdAt: string;
  user: LogUser;
}

type TabType = "all" | "items" | "menus" | "venues" | "users";

const TABS: { key: TabType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "items", label: "Items" },
  { key: "menus", label: "Menus" },
  { key: "venues", label: "Venues" },
  { key: "users", label: "Users" },
];

const USER_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500",
  "bg-rose-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

function userInitials(user: LogUser) {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateGroup(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const logDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (logDay.getTime() === today.getTime()) return "Today";
  if (logDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function actionSentence(log: ActivityLog) {
  const name = log.user.name ?? log.user.email;
  const entity = log.metadata?.entityName ?? log.entityId;
  const action = log.action.toLowerCase();
  const type = log.entityType.toLowerCase();
  return { name, action, type, entity };
}

function SkeletonLog() {
  return (
    <div className="space-y-8">
      {[...Array(3)].map((_, gi) => (
        <div key={gi}>
          <div className="mb-4 h-3.5 w-14 animate-pulse rounded bg-neutral-100" />
          <div className="divide-y divide-neutral-100">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-3 first:pt-0">
                <div className="size-7 shrink-0 animate-pulse rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="h-3.5 w-72 animate-pulse rounded bg-neutral-100" />
                    <div className="h-3 w-10 animate-pulse rounded bg-neutral-100" />
                  </div>
                  <div className="h-9 w-full animate-pulse rounded-md bg-neutral-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function exportCSV(logs: ActivityLog[]) {
  const rows = [["Time", "User", "Action", "Entity Type", "Entity", "Changes"]];
  for (const log of logs) {
    const changes = (log.metadata?.changes ?? [])
      .map((c) => `${c.field}: ${c.old} → ${c.new}`)
      .join("; ");
    rows.push([
      new Date(log.createdAt).toISOString(),
      log.user.name ?? log.user.email,
      log.action,
      log.entityType,
      log.metadata?.entityName ?? log.entityId,
      changes,
    ]);
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("all");

  useEffect(() => {
    let cancelled = false;

    function load(initial: boolean) {
      if (initial) setLoading(true);
      fetch(`/api/activity-log?type=${tab}`)
        .then((r) => r.json())
        .then((j) => { if (!cancelled && j.data) setLogs(j.data); })
        .finally(() => { if (initial) setLoading(false); });
    }

    load(true);
    const interval = setInterval(() => load(false), 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tab]);

  const grouped: { label: string; logs: ActivityLog[] }[] = [];
  for (const log of logs) {
    const label = formatDateGroup(log.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) {
      last.logs.push(log);
    } else {
      grouped.push({ label, logs: [log] });
    }
  }

  return (
    <div>
      {/* Header row: breadcrumb+title on left, tabs+export on right */}
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-neutral-400">
            <History className="size-3.5" />
            <span>System</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Audit log</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every change to properties, venues, menus and items — append-only.
          </p>
        </div>

        {/* Tabs + Export */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
                  tab === key
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(logs)}
            disabled={logs.length === 0}
            className="h-8 gap-1.5 px-3 text-[13px]"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="mb-6 border-t border-neutral-100" />

      {loading ? (
        <SkeletonLog />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <History className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No activity yet</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Changes to properties, venues, menus and items will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ label, logs: groupLogs }) => (
            <div key={label}>
              <p className="mb-4 text-[13px] font-medium text-neutral-400">{label}</p>
              <div className="divide-y divide-neutral-100">
                {groupLogs.map((log) => {
                  const { name, action, type, entity } = actionSentence(log);
                  const changes = log.metadata?.changes ?? [];
                  const color = avatarColor(log.userId);
                  const initials = userInitials(log.user);

                  return (
                    <div key={log.id} className="py-3 first:pt-0">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}
                        >
                          {initials}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-[13px] text-neutral-700">
                              <span className="font-semibold text-neutral-900">{name}</span>
                              {" "}{action}
                              {log.entityType !== "user" && (
                                <>{" "}{type}{" "}<span className="font-semibold text-neutral-900">{entity}</span></>
                              )}
                            </p>
                            <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                              {formatTime(log.createdAt)}
                            </span>
                          </div>

                          {/* Diff rows */}
                          {changes.length > 0 && (
                            <div className="mt-2 overflow-hidden rounded-md border border-neutral-100 bg-neutral-50">
                              {changes.map((c, ci) => (
                                <div
                                  key={ci}
                                  className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2 text-[12px] font-mono last:border-0"
                                >
                                  <span className="w-24 shrink-0 truncate text-neutral-400">{c.field}</span>
                                  <span className="text-red-400 line-through">{String(c.old ?? "—")}</span>
                                  <span className="text-neutral-300">›</span>
                                  <span className="text-emerald-600">{String(c.new ?? "—")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

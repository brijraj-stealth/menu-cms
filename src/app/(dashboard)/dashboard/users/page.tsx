"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { propertyAccess: number; venueAccess: number; menuAccess: number };
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-orange-500", "bg-rose-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500",
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
};
const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  STAFF: "bg-neutral-100 text-neutral-600",
};

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1">
              <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100" />
              <div className="mt-1.5 h-3 w-40 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
          <div className="mt-3 h-3 w-24 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session.user.role === "STAFF") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const json = await res.json();
      if (json.data) setUsers(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && session.user.role !== "STAFF") {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteError(null);
    const toastId = toast.loading("Creating user…");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? "Failed to create user");
        toast.dismiss(toastId);
        return;
      }
      setUsers((prev) => [{ ...json.data, _count: { propertyAccess: 0, venueAccess: 0, menuAccess: 0 } }, ...prev]);
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", password: "", role: "STAFF" });
      toast.success(`${json.data.name || json.data.email} added`, { id: toastId });
    } finally {
      setInviteSubmitting(false);
    }
  }

  if (status === "loading" || (status === "authenticated" && session.user.role === "STAFF")) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading…</div>;
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Dialog
          open={inviteOpen}
          onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteError(null); setInviteForm({ name: "", email: "", password: "", role: "STAFF" }); } }}
        >
          <DialogTrigger
            render={
              <Button size="sm" className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                <Plus className="size-4" /> Invite User
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Full name *</label>
                <Input placeholder="Jane Smith" value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Email *</label>
                <Input type="email" placeholder="jane@example.com" value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Password *</label>
                <Input type="password" placeholder="Min. 8 characters" value={inviteForm.password}
                  onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Role</label>
                <Select value={inviteForm.role} onValueChange={(val) => val && setInviteForm((f) => ({ ...f, role: val }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff — needs explicit access grants</SelectItem>
                    <SelectItem value="ADMIN">Admin — manages users and all content</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin — full platform access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{inviteError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={inviteSubmitting} className="h-8 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  {inviteSubmitting ? "Creating…" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      {loading ? (
        <GridSkeleton />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-20">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <Users className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No users yet</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-400">
            Invite team members to give them access to properties and menus.
          </p>
          <Button onClick={() => setInviteOpen(true)}
            className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
            <Plus className="size-3.5" /> Invite your first user
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => {
            const seed = u.name ?? u.email;
            const color = avatarColor(seed);
            const initial = seed[0]?.toUpperCase() ?? "U";
            return (
              <div
                key={u.id}
                onClick={() => router.push(`/dashboard/users/${u.id}`)}
                className="group cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-colors duration-150 hover:border-neutral-300"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white select-none`}>
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-neutral-900">{u.name ?? u.email}</h3>
                    {u.name && <p className="truncate text-xs text-neutral-400">{u.email}</p>}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[u.role] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {u._count.propertyAccess + u._count.venueAccess + u._count.menuAccess} access
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

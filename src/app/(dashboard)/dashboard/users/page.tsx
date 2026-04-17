"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  STAFF: "bg-gray-100 text-gray-600",
};

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.75" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="ml-auto h-5 w-14 rounded-full bg-muted" />
          <div className="h-7 w-20 rounded bg-muted" />
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to invite user"); return; }
      setUsers((prev) => [
        { ...json.data, _count: { propertyAccess: 0, venueAccess: 0, menuAccess: 0 } },
        ...prev,
      ]);
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      toast.success(`${json.data.name || json.data.email} added`);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || (status === "authenticated" && session.user.role === "STAFF")) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage users and their access permissions.</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          All Users
          {!loading && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({users.length})</span>
          )}
        </h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); setForm({ name: "", email: "", password: "", role: "STAFF" }); } }}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus />
                Invite User
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Email *</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Password *</label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={form.role}
                  onValueChange={(val) => val && setForm((f) => ({ ...f, role: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No users yet</p>
          <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
            <Plus /> Invite your first user
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[u.role] ?? "bg-muted text-muted-foreground"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        render={<Link href={`/dashboard/users/${u.id}/access`} />}
                      >
                        Edit Access
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

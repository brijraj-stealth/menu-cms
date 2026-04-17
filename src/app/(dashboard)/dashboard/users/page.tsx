"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Users, KeyRound, ShieldCheck, Ban, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
        <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="size-11 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1">
              <div className="h-4 w-28 animate-pulse rounded-lg bg-neutral-100" />
              <div className="mt-1.5 h-3 w-40 animate-pulse rounded-lg bg-neutral-100" />
            </div>
          </div>
          <div className="mt-4 h-3 w-24 animate-pulse rounded-lg bg-neutral-100" />
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

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit sheet
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "STAFF" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [toggling, setToggling] = useState(false);

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

  // Sync edit form when a user is selected
  useEffect(() => {
    if (selectedUser) {
      setEditForm({ name: selectedUser.name ?? "", email: selectedUser.email, role: selectedUser.role });
      setEditError(null);
      setNewPassword("");
    }
  }, [selectedUser]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const json = await res.json();
      if (!res.ok) { setInviteError(json.error ?? "Failed to create user"); return; }
      setUsers((prev) => [{ ...json.data, _count: { propertyAccess: 0, venueAccess: 0, menuAccess: 0 } }, ...prev]);
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", password: "", role: "STAFF" });
      toast.success(`${json.data.name || json.data.email} added`);
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) { setEditError(json.error ?? "Failed to save changes"); return; }
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, ...json.data } : u));
      setSelectedUser((prev) => prev ? { ...prev, ...json.data } : null);
      toast.success("Changes saved");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || newPassword.length < 8) return;
    setPasswordSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) { toast.error("Failed to update password"); return; }
      setNewPassword("");
      toast.success("Password updated");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleToggleActive() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/users/${toggleTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      if (res.ok) {
        const json = await res.json();
        setUsers((prev) => prev.map((u) => u.id === toggleTarget.id ? { ...u, isActive: json.data.isActive } : u));
        setSelectedUser((prev) => prev?.id === toggleTarget.id ? { ...prev, isActive: json.data.isActive } : prev);
        toast.success(json.data.isActive ? "Account activated" : "Account deactivated");
      } else {
        toast.error("Failed to update account status");
      }
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        if (selectedUser?.id === deleteTarget.id) setSelectedUser(null);
        toast.success(`${deleteTarget.name ?? deleteTarget.email} removed`);
      } else {
        toast.error("Failed to delete user");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (status === "loading" || (status === "authenticated" && session.user.role === "STAFF")) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading…</div>;
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Restaurant CMS</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">Users</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Dialog
          open={inviteOpen}
          onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteError(null); setInviteForm({ name: "", email: "", password: "", role: "STAFF" }); } }}
        >
          <DialogTrigger
            render={
              <Button size="sm" className="h-10 gap-2 bg-neutral-900 px-5 text-white hover:bg-neutral-700">
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
                    <SelectItem value="STAFF">Staff — Limited access, needs explicit grants</SelectItem>
                    <SelectItem value="ADMIN">Admin — Can manage users and all content</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin — Full platform access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{inviteError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={inviteSubmitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-28">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-neutral-200">
            <Users className="size-8 text-neutral-500" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-neutral-900">No users yet</h3>
          <p className="mt-1.5 max-w-xs text-center text-sm text-neutral-500">
            Invite team members to give them access to properties and menus.
          </p>
          <Button onClick={() => setInviteOpen(true)}
            className="mt-6 h-10 gap-2 bg-neutral-900 px-5 text-white hover:bg-neutral-700">
            <Plus className="size-4" /> Invite your first user
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
                onClick={() => setSelectedUser(u)}
                className="group cursor-pointer rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-400 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${color} text-lg font-bold text-white select-none`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-neutral-900">{u.name ?? u.email}</h3>
                    </div>
                    {u.name && <p className="mt-0.5 text-sm text-neutral-500 truncate">{u.email}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[u.role] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400 group-hover:text-neutral-600 transition-colors">
                    {u._count.propertyAccess + u._count.venueAccess + u._count.menuAccess} access
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(v) => { if (!v) setSelectedUser(null); }}>
        <SheetContent side="right" className="flex flex-col overflow-y-auto p-0 sm:max-w-md">
          {selectedUser && (() => {
            const seed = selectedUser.name ?? selectedUser.email;
            const color = avatarColor(seed);
            const initial = seed[0]?.toUpperCase() ?? "U";
            return (
              <>
                <SheetHeader className="border-b border-neutral-200 px-6 py-5">
                  <div className="flex items-center gap-4 pr-8">
                    <div className={`flex size-14 shrink-0 items-center justify-center rounded-full ${color} text-2xl font-bold text-white select-none`}>
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-lg">{selectedUser.name ?? selectedUser.email}</SheetTitle>
                      {selectedUser.name && <p className="mt-0.5 truncate text-sm text-neutral-500">{selectedUser.email}</p>}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_STYLES[selectedUser.role] ?? ""}`}>
                          {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selectedUser.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                          {selectedUser.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                  {/* Account status toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
                    <div>
                      <p className="font-medium text-neutral-900">Account Access</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {selectedUser.isActive
                          ? "Active — this user can log in"
                          : "Inactive — login is blocked"}
                      </p>
                    </div>
                    <button
                      onClick={() => setToggleTarget(selectedUser)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        selectedUser.isActive
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {selectedUser.isActive ? (
                        <><Ban className="size-3.5" /> Deactivate</>
                      ) : (
                        <><ShieldCheck className="size-3.5" /> Activate</>
                      )}
                    </button>
                  </div>

                  {/* Edit form */}
                  <form onSubmit={handleEditSave} className="flex flex-col gap-4">
                    <p className="text-sm font-semibold text-neutral-900">Profile Details</p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">Full name</label>
                      <Input placeholder="Full name" value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">Email</label>
                      <Input type="email" value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">Role</label>
                      <Select value={editForm.role} onValueChange={(val) => val && setEditForm((f) => ({ ...f, role: val }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STAFF">Staff</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}
                    <Button type="submit" disabled={editSubmitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
                      {editSubmitting ? "Saving…" : "Save Changes"}
                    </Button>
                  </form>

                  {/* Password reset */}
                  <form onSubmit={handlePasswordChange} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-4 text-neutral-400" />
                      <p className="text-sm font-semibold text-neutral-900">Reset Password</p>
                    </div>
                    <p className="text-xs text-neutral-500">Set a new password for this user.</p>
                    <Input
                      type="password"
                      placeholder="New password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="submit"
                      disabled={passwordSubmitting || newPassword.length < 8}
                      variant="outline"
                      className="border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 cursor-pointer"
                    >
                      {passwordSubmitting ? "Updating…" : "Update Password"}
                    </Button>
                  </form>

                  {/* Manage access */}
                  <Button
                    variant="outline"
                    render={<Link href={`/dashboard/users/${selectedUser.id}/access`} />}
                    className="w-full justify-between border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 cursor-pointer"
                  >
                    Manage Property & Menu Access
                    <ArrowRight className="size-4" />
                  </Button>
                </div>

                <SheetFooter className="border-t border-neutral-200 px-6 py-4">
                  <button
                    onClick={() => setDeleteTarget(selectedUser)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-400"
                  >
                    <Trash2 className="size-4" />
                    Delete User
                  </button>
                </SheetFooter>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Confirm: toggle active */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(v) => { if (!v) setToggleTarget(null); }}
        title={toggleTarget?.isActive ? "Deactivate account?" : "Activate account?"}
        description={
          toggleTarget?.isActive
            ? `${toggleTarget.name ?? toggleTarget.email} will be blocked from logging in. Their access settings are preserved.`
            : `${toggleTarget?.name ?? toggleTarget?.email} will be able to log in again.`
        }
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Activate"}
        onConfirm={handleToggleActive}
        loading={toggling}
      />

      {/* Confirm: delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete user?"
        description={`${deleteTarget?.name ?? deleteTarget?.email} and all their access records will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

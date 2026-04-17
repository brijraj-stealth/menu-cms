"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, KeyRound, ShieldCheck, Ban, Trash2, ArrowRight, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
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

function PageSkeleton() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 p-5">
        <div className="size-16 animate-pulse rounded-full bg-neutral-100" />
        <div>
          <div className="h-5 w-40 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-2 h-4 w-52 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4 rounded-2xl border border-neutral-200 p-5">
          <div className="h-4 w-32 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const [editForm, setEditForm] = useState({ name: "", email: "", role: "STAFF" });
  const [newPassword, setNewPassword] = useState("");

  const [toggleTarget, setToggleTarget] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const res = await fetch(`/api/users/${id}`);
      const json = await res.json();
      if (json.data) {
        setUser(json.data);
        setEditForm({ name: json.data.name ?? "", email: json.data.email, role: json.data.role });
      } else {
        toast.error("User not found");
      }
      setLoading(false);
    }
    fetchUser();
  }, [id]);

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    const toastId = toast.loading("Saving profile changes…");
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save changes", { id: toastId });
        return;
      }
      setUser((prev) => prev ? { ...prev, ...json.data } : null);
      toast.success("Profile updated", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return;
    const toastId = toast.loading("Updating password…");
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        toast.error("Failed to update password", { id: toastId });
        return;
      }
      setNewPassword("");
      toast.success("Password updated", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    }
  }

  async function handleToggleActive() {
    if (!user) return;
    setToggling(true);
    const action = user.isActive ? "Deactivating account…" : "Activating account…";
    const toastId = toast.loading(action);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to update account status", { id: toastId });
        return;
      }
      setUser((prev) => prev ? { ...prev, isActive: json.data.isActive } : null);
      toast.success(json.data.isActive ? "Account activated" : "Account deactivated", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setToggling(false);
      setToggleTarget(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting user…");
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete user", { id: toastId });
        return;
      }
      toast.success(`${user.name ?? user.email} deleted`, { id: toastId });
      router.replace("/dashboard/users");
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!user) return <div className="py-20 text-center text-sm text-red-600">User not found.</div>;

  const seed = user.name ?? user.email;
  const color = avatarColor(seed);
  const initial = seed[0]?.toUpperCase() ?? "U";

  return (
    <div className="max-w-2xl">
      {/* Back nav */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/users" />}
          className="-ml-2 cursor-pointer text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="size-4" /> All Users
        </Button>
        <Button variant="outline" size="sm"
          render={<Link href={`/dashboard/users/${id}/access`} />}
          className="cursor-pointer gap-1.5 border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50">
          Manage Access <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* User header */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className={`flex size-16 shrink-0 items-center justify-center rounded-full ${color} text-2xl font-bold text-white select-none`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-neutral-900">{user.name ?? user.email}</h1>
          {user.name && <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>}
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-neutral-100 text-neutral-600"}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Profile Details */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Profile Details</h2>
          <form onSubmit={handleEditSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Full name</label>
              <Input
                placeholder="Full name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Email address</label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Role</label>
              <Select value={editForm.role} onValueChange={(val) => val && setEditForm((f) => ({ ...f, role: val }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff — needs explicit access grants</SelectItem>
                  <SelectItem value="ADMIN">Admin — manages users and all content</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin — full platform access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-1">
              <Button type="submit" className="bg-neutral-900 text-white hover:bg-neutral-700 cursor-pointer">
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Reset Password */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="size-4 text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Reset Password</h2>
          </div>
          <p className="mb-4 text-xs text-neutral-500">
            Set a new password for this user. They will need to use it on their next login.
          </p>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
            <Input
              type="password"
              placeholder="New password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div>
              <Button
                type="submit"
                variant="outline"
                disabled={newPassword.length < 8}
                className="cursor-pointer border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50"
              >
                Update Password
              </Button>
            </div>
          </form>
        </div>

        {/* Account Status */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Account Status</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {user.isActive
                  ? "This account is active. The user can log in and access their permitted resources."
                  : "This account is inactive. The user cannot log in until reactivated."}
              </p>
            </div>
            <button
              onClick={() => setToggleTarget(true)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                user.isActive
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {user.isActive ? (
                <><Ban className="size-4" /> Deactivate</>
              ) : (
                <><ShieldCheck className="size-4" /> Activate</>
              )}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-red-500" />
                <h2 className="text-sm font-semibold text-red-800">Danger Zone</h2>
              </div>
              <p className="mt-0.5 text-xs text-red-600">
                Permanently delete this user and all their access records. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white"
            >
              <Trash2 className="size-4" /> Delete User
            </button>
          </div>
        </div>
      </div>

      {/* Confirm: toggle active */}
      <ConfirmDialog
        open={toggleTarget}
        onOpenChange={(v) => setToggleTarget(v)}
        title={user.isActive ? "Deactivate account?" : "Activate account?"}
        description={
          user.isActive
            ? `${user.name ?? user.email} will be blocked from logging in. Their access settings are preserved and can be restored by reactivating.`
            : `${user.name ?? user.email} will be able to log in again with their existing access permissions.`
        }
        confirmLabel={user.isActive ? "Deactivate" : "Activate"}
        onConfirm={handleToggleActive}
        loading={toggling}
      />

      {/* Confirm: delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => setDeleteOpen(v)}
        title="Delete user permanently?"
        description={`${user.name ?? user.email} and all their access records will be removed forever. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

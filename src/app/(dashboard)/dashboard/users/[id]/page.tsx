"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, KeyRound, ShieldCheck, Ban, Trash2, ArrowRight, ShieldAlert, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

type Permission = "VIEW" | "ADD" | "EDIT" | "DELETE";
interface PropertyAccess { permissions: Permission[]; property: { id: string; name: string }; }
interface VenueAccess { permissions: Permission[]; venue: { id: string; name: string; propertyId: string }; }
interface MenuAccess { permissions: Permission[]; menu: { id: string; name: string; venueId: string }; }
interface VenueStub { id: string; name: string; menus: { id: string }[]; }
interface PropertyStub { id: string; name: string; venues: VenueStub[]; }
interface AccessSummary {
  properties: PropertyStub[];
  propertyAccess: PropertyAccess[];
  venueAccess: VenueAccess[];
  menuAccess: MenuAccess[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-orange-500", "bg-rose-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500",
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", STAFF: "Staff" };
const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  STAFF: "bg-neutral-100 text-neutral-600",
};

const PERM_LABELS: Record<Permission, string> = { VIEW: "View", ADD: "Add", EDIT: "Edit", DELETE: "Delete" };

// ── Access summary panel (right column) ──────────────────────────────────────
function AccessPanel({ access, userId, isAdmin }: {
  access: AccessSummary | null;
  userId: string;
  isAdmin: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Access</h2>
        <Link
          href={`/dashboard/users/${userId}/access`}
          className="flex cursor-pointer items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Edit <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="p-5">
        {isAdmin ? (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3">
            <ShieldCheck className="size-4 shrink-0 text-blue-500" />
            <p className="text-xs text-blue-700 font-medium">Full access to everything</p>
          </div>
        ) : !access ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : access.properties.length === 0 ? (
          <p className="text-xs text-neutral-400">No properties found.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {access.properties.map((prop) => {
              const pAccess = access.propertyAccess.find((a) => a.property.id === prop.id);
              return (
                <div key={prop.id}>
                  {/* Property row */}
                  <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-neutral-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] font-bold text-neutral-600">
                        {prop.name[0]?.toUpperCase()}
                      </div>
                      <span className="truncate text-xs font-semibold text-neutral-800">{prop.name}</span>
                    </div>
                    {pAccess ? (
                      <div className="flex shrink-0 gap-0.5 ml-2">
                        {pAccess.permissions.map((p) => (
                          <span key={p} title={PERM_LABELS[p]}
                            className="rounded bg-neutral-900 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                            {p[0]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-[11px] text-neutral-400">
                        <Lock className="size-2.5" /> No access
                      </span>
                    )}
                  </div>

                  {/* Venue rows — only if property has access */}
                  {pAccess && prop.venues.map((venue) => {
                    const vAccess = access.venueAccess.find((a) => a.venue.id === venue.id);
                    const menuCount = access.menuAccess.filter((a) => a.menu.venueId === venue.id).length;
                    return (
                      <div key={venue.id} className="flex items-center justify-between rounded-lg py-1.5 pl-7 pr-2 hover:bg-neutral-50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="size-1 shrink-0 rounded-full bg-neutral-300" />
                          <span className="truncate text-xs text-neutral-600">{venue.name}</span>
                          {menuCount > 0 && (
                            <span className="shrink-0 text-[10px] text-neutral-400">{menuCount}m</span>
                          )}
                        </div>
                        {vAccess ? (
                          <div className="flex shrink-0 gap-0.5 ml-2">
                            {vAccess.permissions.map((p) => (
                              <span key={p} title={PERM_LABELS[p]}
                                className="rounded bg-neutral-700 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                                {p[0]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="ml-2 shrink-0 text-[11px] text-neutral-400">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {!isAdmin && access && (
          <Link
            href={`/dashboard/users/${userId}/access`}
            className="mt-4 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2.5 text-xs font-medium text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            Manage Full Access <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div>
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mb-6 h-24 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100 lg:col-span-2" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [access, setAccess] = useState<AccessSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [editForm, setEditForm] = useState({ name: "", email: "", role: "STAFF" });
  const [newPassword, setNewPassword] = useState("");

  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      const [userRes, accessRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch(`/api/users/${id}/access`),
      ]);
      const [userJson, accessJson] = await Promise.all([userRes.json(), accessRes.json()]);

      if (userJson.data) {
        setUser(userJson.data);
        setEditForm({ name: userJson.data.name ?? "", email: userJson.data.email, role: userJson.data.role });
      } else {
        toast.error("User not found");
      }
      if (accessJson.data) {
        setAccess({
          properties: accessJson.data.properties,
          propertyAccess: accessJson.data.propertyAccess,
          venueAccess: accessJson.data.venueAccess,
          menuAccess: accessJson.data.menuAccess,
        });
      }
      setLoading(false);
    }
    fetchAll();
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
      if (!res.ok) { toast.error(json.error ?? "Failed to save", { id: toastId }); return; }
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
      if (!res.ok) { toast.error("Failed to update password", { id: toastId }); return; }
      setNewPassword("");
      toast.success("Password updated", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    }
  }

  async function handleToggleActive() {
    if (!user) return;
    setToggling(true);
    const toastId = toast.loading(user.isActive ? "Deactivating account…" : "Activating account…");
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error("Failed to update status", { id: toastId }); return; }
      setUser((prev) => prev ? { ...prev, isActive: json.data.isActive } : null);
      toast.success(json.data.isActive ? "Account activated" : "Account deactivated", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setToggling(false);
      setToggleOpen(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting user…");
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete user", { id: toastId }); return; }
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
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard/users" />}
        className="-ml-2 mb-6 cursor-pointer text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> All Users
      </Button>

      {/* User header card */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-full ${color} text-2xl font-bold text-white select-none`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-neutral-900">{user.name ?? user.email}</h1>
          {user.name && <p className="text-sm text-neutral-500">{user.email}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-neutral-100 text-neutral-600"}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        {/* Status toggle in header */}
        <button
          onClick={() => setToggleOpen(true)}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            user.isActive
              ? "bg-neutral-100 text-neutral-600 hover:bg-red-50 hover:text-red-600"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {user.isActive ? <><Ban className="size-4" /> Deactivate</> : <><ShieldCheck className="size-4" /> Activate</>}
        </button>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: edit forms */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Profile Details */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Profile Details</h2>
            <form onSubmit={handleEditSave} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-neutral-600">Full name</label>
                  <Input placeholder="Full name" value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-neutral-600">Email address</label>
                  <Input type="email" value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-600">Role</label>
                <Select value={editForm.role} onValueChange={(val) => val && setEditForm((f) => ({ ...f, role: val }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff — needs explicit access grants</SelectItem>
                    <SelectItem value="ADMIN">Admin — manages users and all content</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin — full platform access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button type="submit" className="cursor-pointer bg-neutral-900 text-white hover:bg-neutral-700">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Reset Password */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="size-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Reset Password</h2>
            </div>
            <form onSubmit={handlePasswordChange} className="flex gap-3">
              <Input
                type="password"
                placeholder="New password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={newPassword.length < 8}
                className="shrink-0 cursor-pointer border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50"
              >
                Update
              </Button>
            </form>
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
                  Permanently removes this user and all their access records.
                </p>
              </div>
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white"
              >
                <Trash2 className="size-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Right: access panel (sticky) */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          <AccessPanel access={access} userId={id} isAdmin={isAdminUser} />
        </div>
      </div>

      {/* Confirm: toggle */}
      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={(v) => setToggleOpen(v)}
        title={user.isActive ? "Deactivate account?" : "Activate account?"}
        description={
          user.isActive
            ? `${user.name ?? user.email} will be blocked from logging in. Their access settings are preserved.`
            : `${user.name ?? user.email} will be able to log in again with their existing permissions.`
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
        description={`${user.name ?? user.email} and all their access records will be removed forever. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

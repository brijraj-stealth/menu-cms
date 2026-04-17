"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, KeyRound, ShieldCheck, Ban, Trash2, ShieldAlert,
  Plus, Lock, ChevronDown, ChevronRight, Info,
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
const ALL_PERMS: Permission[] = ["VIEW", "ADD", "EDIT", "DELETE"];

const PERM_LABELS: Record<Permission, string> = {
  VIEW: "View", ADD: "Add", EDIT: "Edit", DELETE: "Delete",
};
const PERM_DESCRIPTIONS: Record<Permission, string> = {
  VIEW: "Can browse and see all content",
  ADD: "Can create new items, categories, and menus",
  EDIT: "Can update names, prices, and descriptions",
  DELETE: "Can permanently remove content",
};

interface PropertyAccess { id: string; permissions: Permission[]; property: { id: string; name: string; slug: string }; }
interface VenueAccess { id: string; permissions: Permission[]; venue: { id: string; name: string; propertyId: string }; }
interface MenuAccess { id: string; permissions: Permission[]; menu: { id: string; name: string; venueId: string }; }
interface MenuStub { id: string; name: string; venueId: string; }
interface VenueStub { id: string; name: string; propertyId: string; menus: MenuStub[]; }
interface PropertyStub { id: string; name: string; slug: string; venues: VenueStub[]; }
interface AccessData {
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

// ── Permission toggle boxes (full words) ─────────────────────────────────────
function PermToggles({ permissions, onChange }: {
  permissions: Permission[];
  onChange: (perms: Permission[]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ALL_PERMS.map((p) => {
        const active = permissions.includes(p);
        return (
          <button
            key={p}
            type="button"
            title={PERM_DESCRIPTIONS[p]}
            onClick={() => {
              const next = active ? permissions.filter((x) => x !== p) : [...permissions, p];
              if (next.length > 0) onChange(next);
            }}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-800"
            }`}
          >
            {PERM_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

// ── Inline grant form ────────────────────────────────────────────────────────
function GrantForm({ label, onGrant, onCancel }: {
  label: string;
  onGrant: (perms: Permission[]) => void;
  onCancel: () => void;
}) {
  const [perms, setPerms] = useState<Permission[]>(["VIEW"]);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
      <span className="text-xs font-medium text-neutral-500">
        Permissions for <span className="text-neutral-800">{label}</span>:
      </span>
      <PermToggles permissions={perms} onChange={setPerms} />
      <div className="flex items-center gap-2">
        <Button size="xs" onClick={() => onGrant(perms)}
          className="cursor-pointer bg-neutral-900 text-white hover:bg-neutral-700">
          Confirm Grant
        </Button>
        <button onClick={onCancel} className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-700">
          Cancel
        </button>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "STAFF" });
  const [newPassword, setNewPassword] = useState("");
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Access state
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pendingGrant, setPendingGrant] = useState<{
    type: "property" | "venue" | "menu";
    targetId: string;
    targetName: string;
    perms: Permission[];
  } | null>(null);
  const [granting, setGranting] = useState(false);
  const [openGrantForms, setOpenGrantForms] = useState<Set<string>>(new Set());
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  const fetchAccess = useCallback(async () => {
    const res = await fetch(`/api/users/${id}/access`);
    const json = await res.json();
    if (json.data) {
      setAccessData({
        properties: json.data.properties,
        propertyAccess: json.data.propertyAccess,
        venueAccess: json.data.venueAccess,
        menuAccess: json.data.menuAccess,
      });
      setExpandedProps((prev) => {
        const next = new Set(prev);
        json.data.propertyAccess.forEach((a: PropertyAccess) => next.add(a.property.id));
        return next;
      });
      setExpandedVenues((prev) => {
        const next = new Set(prev);
        json.data.venueAccess.forEach((a: VenueAccess) => next.add(a.venue.id));
        return next;
      });
    }
  }, [id]);

  useEffect(() => {
    async function fetchAll() {
      const [userRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetchAccess(),
      ]);
      const userJson = await userRes.json();
      if (userJson.data) {
        setUser(userJson.data);
        setEditForm({ name: userJson.data.name ?? "", email: userJson.data.email, role: userJson.data.role });
      } else {
        toast.error("User not found");
      }
      setLoading(false);
    }
    fetchAll();
  }, [id, fetchAccess]);

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

  function toggleGrantForm(key: string) {
    setOpenGrantForms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function saveAccess(type: "property" | "venue" | "menu", targetId: string, permissions: Permission[]) {
    if (permissions.length === 0) return;
    const toastId = toast.loading("Updating access…");
    await fetch(`/api/users/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, targetId, permissions }),
    });
    await fetchAccess();
    toast.success("Access updated", { id: toastId });
    setOpenGrantForms((prev) => { const next = new Set(prev); next.delete(`${type}:${targetId}`); return next; });
  }

  async function handleConfirmGrant() {
    if (!pendingGrant) return;
    setGranting(true);
    try {
      await saveAccess(pendingGrant.type, pendingGrant.targetId, pendingGrant.perms);
    } finally {
      setGranting(false);
      setPendingGrant(null);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    const toastId = toast.loading("Removing access…");
    try {
      await fetch(`/api/users/${id}/access`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: removeTarget.type, targetId: removeTarget.id }),
      });
      await fetchAccess();
      toast.success("Access removed", { id: toastId });
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: edit forms */}
        <div className="flex flex-col gap-4">
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

        {/* Right: full access management */}
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Access</h2>
          </div>

          <div className="p-5">
            {isAdminUser ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                <p className="font-semibold text-blue-900">Admin — Full Access</p>
                <p className="mt-1 text-sm text-blue-700">
                  Admin and Super Admin users have access to all properties, venues, and menus without needing explicit grants.
                </p>
              </div>
            ) : !accessData ? (
              <div className="flex flex-col gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-100" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* How access works */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <div>
                      <p className="mb-2 text-xs font-semibold text-neutral-800">How access works</p>
                      <p className="mb-2.5 text-xs text-neutral-500">
                        Grant property access first — venue access unlocks underneath, then menu access.
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {ALL_PERMS.map((p) => (
                          <div key={p} className="flex items-start gap-1.5 text-xs">
                            <span className="mt-0.5 inline-block rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-semibold text-neutral-700 leading-none text-[10px]">
                              {PERM_LABELS[p]}
                            </span>
                            <span className="text-neutral-500">{PERM_DESCRIPTIONS[p]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cascade tree */}
                {accessData.properties.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-400">
                    No properties found. Create a property first.
                  </div>
                ) : (
                  accessData.properties.map((prop) => {
                    const pAccess = accessData.propertyAccess.find((a) => a.property.id === prop.id);
                    const isPropExpanded = expandedProps.has(prop.id);
                    const propGrantKey = `property:${prop.id}`;

                    return (
                      <div key={prop.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {/* Property row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            onClick={() => setExpandedProps((p) => {
                              const n = new Set(p);
                              if (n.has(prop.id)) n.delete(prop.id); else n.add(prop.id);
                              return n;
                            })}
                            className="flex shrink-0 cursor-pointer items-center text-neutral-400 hover:text-neutral-700"
                          >
                            {isPropExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 select-none">
                            {prop.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-900">{prop.name}</p>
                            <p className="text-xs text-neutral-400">{prop.venues.length} venue{prop.venues.length !== 1 ? "s" : ""}</p>
                          </div>
                          {pAccess ? (
                            <div className="flex shrink-0 items-center gap-2">
                              <PermToggles
                                permissions={pAccess.permissions}
                                onChange={(perms) => saveAccess("property", prop.id, perms)}
                              />
                              <button
                                onClick={() => setRemoveTarget({ type: "property", id: prop.id, name: prop.name })}
                                className="ml-1 cursor-pointer rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title="Remove property access"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { toggleGrantForm(propGrantKey); setExpandedProps((p) => new Set([...p, prop.id])); }}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
                            >
                              <Plus className="size-3.5" /> Grant Access
                            </button>
                          )}
                        </div>

                        {/* Property grant form */}
                        {openGrantForms.has(propGrantKey) && !pAccess && (
                          <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                            <GrantForm
                              label={prop.name}
                              onGrant={(perms) => {
                                setPendingGrant({ type: "property", targetId: prop.id, targetName: prop.name, perms });
                                toggleGrantForm(propGrantKey);
                              }}
                              onCancel={() => toggleGrantForm(propGrantKey)}
                            />
                          </div>
                        )}

                        {/* Venues — only if property access exists */}
                        {isPropExpanded && pAccess && (
                          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Venues</p>
                            <div className="flex flex-col gap-2">
                              {prop.venues.map((venue) => {
                                const vAccess = accessData.venueAccess.find((a) => a.venue.id === venue.id);
                                const isVenueExpanded = expandedVenues.has(venue.id);
                                const venueGrantKey = `venue:${venue.id}`;

                                return (
                                  <div key={venue.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                      {vAccess && venue.menus.length > 0 ? (
                                        <button
                                          onClick={() => setExpandedVenues((p) => {
                                            const n = new Set(p);
                                            if (n.has(venue.id)) n.delete(venue.id); else n.add(venue.id);
                                            return n;
                                          })}
                                          className="flex shrink-0 cursor-pointer items-center text-neutral-400 hover:text-neutral-700"
                                        >
                                          {isVenueExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                        </button>
                                      ) : (
                                        <div className="w-4 shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-neutral-800">{venue.name}</p>
                                        <p className="text-xs text-neutral-400">{venue.menus.length} menu{venue.menus.length !== 1 ? "s" : ""}</p>
                                      </div>
                                      {vAccess ? (
                                        <div className="flex shrink-0 items-center gap-2">
                                          <PermToggles
                                            permissions={vAccess.permissions}
                                            onChange={(perms) => saveAccess("venue", venue.id, perms)}
                                          />
                                          <button
                                            onClick={() => setRemoveTarget({ type: "venue", id: venue.id, name: venue.name })}
                                            className="ml-1 cursor-pointer rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                          >
                                            <Trash2 className="size-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => { toggleGrantForm(venueGrantKey); setExpandedVenues((p) => new Set([...p, venue.id])); }}
                                          className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
                                        >
                                          <Plus className="size-3" /> Grant Access
                                        </button>
                                      )}
                                    </div>

                                    {openGrantForms.has(venueGrantKey) && !vAccess && (
                                      <div className="border-t border-neutral-100 px-3 pb-3 pt-2.5">
                                        <GrantForm
                                          label={venue.name}
                                          onGrant={(perms) => {
                                            setPendingGrant({ type: "venue", targetId: venue.id, targetName: venue.name, perms });
                                            toggleGrantForm(venueGrantKey);
                                          }}
                                          onCancel={() => toggleGrantForm(venueGrantKey)}
                                        />
                                      </div>
                                    )}

                                    {/* Menus — only if venue access exists */}
                                    {isVenueExpanded && vAccess && venue.menus.length > 0 && (
                                      <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-3">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Menus</p>
                                        <div className="flex flex-col gap-1.5">
                                          {venue.menus.map((menu) => {
                                            const mAccess = accessData.menuAccess.find((a) => a.menu.id === menu.id);
                                            const menuGrantKey = `menu:${menu.id}`;
                                            return (
                                              <div key={menu.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                                                <div className="flex items-center gap-3 px-3 py-2.5">
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-neutral-800">{menu.name}</p>
                                                  </div>
                                                  {mAccess ? (
                                                    <div className="flex shrink-0 items-center gap-2">
                                                      <PermToggles
                                                        permissions={mAccess.permissions}
                                                        onChange={(perms) => saveAccess("menu", menu.id, perms)}
                                                      />
                                                      <button
                                                        onClick={() => setRemoveTarget({ type: "menu", id: menu.id, name: menu.name })}
                                                        className="ml-1 cursor-pointer rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                      >
                                                        <Trash2 className="size-3.5" />
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <button
                                                      onClick={() => toggleGrantForm(menuGrantKey)}
                                                      className="flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-400 transition hover:border-neutral-900 hover:text-neutral-900"
                                                    >
                                                      <Plus className="size-3" /> Grant Access
                                                    </button>
                                                  )}
                                                </div>
                                                {openGrantForms.has(menuGrantKey) && !mAccess && (
                                                  <div className="border-t border-neutral-100 px-3 pb-3 pt-2">
                                                    <GrantForm
                                                      label={menu.name}
                                                      onGrant={(perms) => {
                                                        setPendingGrant({ type: "menu", targetId: menu.id, targetName: menu.name, perms });
                                                        toggleGrantForm(menuGrantKey);
                                                      }}
                                                      onCancel={() => toggleGrantForm(menuGrantKey)}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Locked: no property access */}
                        {isPropExpanded && !pAccess && (
                          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              <Lock className="size-3.5" />
                              Grant property access above to unlock venue and menu access
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
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

      {/* Confirm: grant access */}
      <ConfirmDialog
        open={!!pendingGrant}
        onOpenChange={(v) => { if (!v) setPendingGrant(null); }}
        title="Confirm access grant"
        description={
          pendingGrant
            ? `Grant ${pendingGrant.perms.map((p) => PERM_LABELS[p]).join(", ")} access to "${pendingGrant.targetName}"?`
            : ""
        }
        confirmLabel="Grant Access"
        onConfirm={handleConfirmGrant}
        loading={granting}
      />

      {/* Confirm: remove access */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}
        title="Remove access?"
        description={`"${removeTarget?.name}" access will be revoked. The user will no longer be able to perform any actions on this ${removeTarget?.type}.`}
        confirmLabel="Remove Access"
        onConfirm={handleRemove}
        loading={removing}
      />
    </div>
  );
}

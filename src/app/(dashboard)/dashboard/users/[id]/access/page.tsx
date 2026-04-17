"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Lock, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Permission = "VIEW" | "ADD" | "EDIT" | "DELETE";
const ALL_PERMS: Permission[] = ["VIEW", "ADD", "EDIT", "DELETE"];

const PERM_LABELS: Record<Permission, string> = {
  VIEW: "View",
  ADD: "Add",
  EDIT: "Edit",
  DELETE: "Delete",
};

const PERM_DESCRIPTIONS: Record<Permission, string> = {
  VIEW: "Can browse and see all content",
  ADD: "Can create new items, categories, and menus",
  EDIT: "Can update names, prices, and descriptions",
  DELETE: "Can permanently remove content",
};

interface UserInfo { id: string; name: string | null; email: string; role: string; }
interface PropertyAccess { id: string; permissions: Permission[]; property: { id: string; name: string; slug: string }; }
interface VenueAccess { id: string; permissions: Permission[]; venue: { id: string; name: string; propertyId: string }; }
interface MenuAccess { id: string; permissions: Permission[]; menu: { id: string; name: string; venueId: string }; }
interface MenuStub { id: string; name: string; venueId: string; }
interface VenueStub { id: string; name: string; propertyId: string; menus: MenuStub[]; }
interface PropertyStub { id: string; name: string; slug: string; venues: VenueStub[]; }
interface AccessData {
  user: UserInfo;
  properties: PropertyStub[];
  propertyAccess: PropertyAccess[];
  venueAccess: VenueAccess[];
  menuAccess: MenuAccess[];
}

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
      <span className="text-xs font-medium text-neutral-500">Permissions for <span className="text-neutral-800">{label}</span>:</span>
      <PermToggles permissions={perms} onChange={setPerms} />
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          onClick={() => onGrant(perms)}
          className="cursor-pointer bg-neutral-900 text-white hover:bg-neutral-700"
        >
          Confirm Grant
        </Button>
        <button onClick={onCancel} className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div>
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mb-8 flex items-center gap-4">
        <div className="size-14 animate-pulse rounded-full bg-neutral-100" />
        <div>
          <div className="h-5 w-36 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-1.5 h-4 w-48 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4 rounded-2xl border border-neutral-200 p-5">
          <div className="h-4 w-48 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-3 h-3 w-64 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  STAFF: "bg-neutral-100 text-neutral-600",
};
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-orange-500", "bg-rose-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500",
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function UserAccessPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);

  // Remove access confirm
  const [removeTarget, setRemoveTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  // Grant access confirm: stores what to grant, shown in ConfirmDialog
  const [pendingGrant, setPendingGrant] = useState<{
    type: "property" | "venue" | "menu";
    targetId: string;
    targetName: string;
    perms: Permission[];
  } | null>(null);
  const [granting, setGranting] = useState(false);

  // Which grant forms are open
  const [openGrantForms, setOpenGrantForms] = useState<Set<string>>(new Set());
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/users/${id}/access`);
    const json = await res.json();
    if (json.data) {
      setData(json.data);
      const newExpandedProps = new Set<string>();
      const newExpandedVenues = new Set<string>();
      json.data.propertyAccess.forEach((a: PropertyAccess) => newExpandedProps.add(a.property.id));
      json.data.venueAccess.forEach((a: VenueAccess) => newExpandedVenues.add(a.venue.id));
      setExpandedProps(newExpandedProps);
      setExpandedVenues(newExpandedVenues);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleGrantForm(key: string) {
    setOpenGrantForms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function saveAccess(type: "property" | "venue" | "menu", targetId: string, permissions: Permission[]) {
    if (permissions.length === 0) return;
    await fetch(`/api/users/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, targetId, permissions }),
    });
    fetchData();
    toast.success("Access updated");
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
    try {
      await fetch(`/api/users/${id}/access`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: removeTarget.type, targetId: removeTarget.id }),
      });
      fetchData();
      toast.success("Access removed");
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!data) return <div className="py-20 text-center text-sm text-red-600">User not found.</div>;

  const { user, properties, propertyAccess, venueAccess, menuAccess } = data;
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const seed = user.name ?? user.email;
  const color = avatarColor(seed);
  const initial = seed[0]?.toUpperCase() ?? "U";

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard/users" />}
        className="-ml-2 mb-6 cursor-pointer text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> All Users
      </Button>

      {/* User info card */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-full ${color} text-2xl font-bold text-white select-none`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-bold text-neutral-900">{user.name ?? user.email}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-neutral-100 text-neutral-600"}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>
        </div>
      </div>

      {isAdminUser ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-5">
          <p className="font-semibold text-blue-900">Admin — Full Access</p>
          <p className="mt-1 text-sm text-blue-700">
            Admin and Super Admin users have access to all properties, venues, and menus without needing explicit grants. No access configuration is required.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Legend / How it works */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-2">How access works</p>
                <p className="mb-3 text-xs text-neutral-500">
                  Grant property access first — venue access unlocks underneath, then menu access. Use the permission buttons to control exactly what this user can do.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {ALL_PERMS.map((p) => (
                    <div key={p} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 inline-block rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-semibold text-neutral-700 leading-none">
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
          {properties.map((prop) => {
            const pAccess = propertyAccess.find((a) => a.property.id === prop.id);
            const isPropExpanded = expandedProps.has(prop.id);
            const propGrantKey = `property:${prop.id}`;

            return (
              <div key={prop.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {/* Property row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button
                    onClick={() => setExpandedProps((p) => { const n = new Set(p); if (n.has(prop.id)) n.delete(prop.id); else n.add(prop.id); return n; })}
                    className="flex shrink-0 cursor-pointer items-center text-neutral-400 hover:text-neutral-700"
                    title={isPropExpanded ? "Collapse" : "Expand"}
                  >
                    {isPropExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-600 select-none">
                    {prop.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900">{prop.name}</p>
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
                  <div className="border-t border-neutral-100 px-5 pb-4 pt-3">
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
                  <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Venues</p>
                    <div className="flex flex-col gap-2">
                      {prop.venues.map((venue) => {
                        const vAccess = venueAccess.find((a) => a.venue.id === venue.id);
                        const isVenueExpanded = expandedVenues.has(venue.id);
                        const venueGrantKey = `venue:${venue.id}`;

                        return (
                          <div key={venue.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                            <div className="flex items-center gap-3 px-4 py-3">
                              {vAccess && venue.menus.length > 0 ? (
                                <button
                                  onClick={() => setExpandedVenues((p) => { const n = new Set(p); if (n.has(venue.id)) n.delete(venue.id); else n.add(venue.id); return n; })}
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
                              <div className="border-t border-neutral-100 px-4 pb-3 pt-2.5">
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
                              <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Menus</p>
                                <div className="flex flex-col gap-1.5">
                                  {venue.menus.map((menu) => {
                                    const mAccess = menuAccess.find((a) => a.menu.id === menu.id);
                                    const menuGrantKey = `menu:${menu.id}`;
                                    return (
                                      <div key={menu.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                                        <div className="flex items-center gap-3 px-3.5 py-2.5">
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
                                          <div className="border-t border-neutral-100 px-3.5 pb-3 pt-2">
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
                  <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Lock className="size-3.5" />
                      Grant property access above to unlock venue and menu access
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {properties.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-400">
              No properties found. Create a property first.
            </div>
          )}
        </div>
      )}

      {/* Confirm: grant access */}
      <ConfirmDialog
        open={!!pendingGrant}
        onOpenChange={(v) => { if (!v) setPendingGrant(null); }}
        title="Confirm access grant"
        description={
          pendingGrant
            ? `Grant ${pendingGrant.perms.map((p) => PERM_LABELS[p]).join(", ")} access to "${pendingGrant.targetName}"? This user will be able to ${pendingGrant.perms.includes("DELETE") ? "view, modify, and delete" : pendingGrant.perms.includes("EDIT") ? "view and modify" : "view"} content within this ${pendingGrant.type}.`
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

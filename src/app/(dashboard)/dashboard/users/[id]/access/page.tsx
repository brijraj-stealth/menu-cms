"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Lock, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Permission = "VIEW" | "ADD" | "EDIT" | "DELETE";
const ALL_PERMS: Permission[] = ["VIEW", "ADD", "EDIT", "DELETE"];
const PERM_LABELS: Record<Permission, string> = { VIEW: "View", ADD: "Add", EDIT: "Edit", DELETE: "Delete" };

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

// ── Permission toggle pills ──────────────────────────────────────────────────
function PermToggles({ permissions, onChange, disabled }: {
  permissions: Permission[];
  onChange: (perms: Permission[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {ALL_PERMS.map((p) => {
        const active = permissions.includes(p);
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = active ? permissions.filter((x) => x !== p) : [...permissions, p];
              if (next.length > 0) onChange(next);
            }}
            title={PERM_LABELS[p]}
            className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
              active
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {p[0]}
          </button>
        );
      })}
    </div>
  );
}

// ── Inline grant form ────────────────────────────────────────────────────────
function GrantForm({ label, onGrant, onCancel }: {
  label: string;
  onGrant: (perms: Permission[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [perms, setPerms] = useState<Permission[]>(["VIEW"]);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
      <span className="text-xs font-medium text-neutral-500">Permissions for {label}:</span>
      <PermToggles permissions={perms} onChange={setPerms} />
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          disabled={saving || perms.length === 0}
          onClick={async () => { setSaving(true); await onGrant(perms); setSaving(false); }}
          className="bg-neutral-900 text-white hover:bg-neutral-700"
        >
          {saving ? "Saving…" : "Grant Access"}
        </Button>
        <button onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
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
        <div className="size-12 animate-pulse rounded-full bg-neutral-100" />
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

export default function UserAccessPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  // Which grant forms are open: "prop:{id}", "venue:{id}", "menu:{id}"
  const [openGrantForms, setOpenGrantForms] = useState<Set<string>>(new Set());
  // Which property sections are expanded
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());
  // Which venue sections are expanded
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/users/${id}/access`);
    const json = await res.json();
    if (json.data) {
      setData(json.data);
      // Auto-expand properties/venues where user has access
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

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard/users" />} className="-ml-2 mb-6 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> All Users
      </Button>

      {/* User info */}
      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-bold uppercase text-neutral-700">
          {user.name?.[0] ?? user.email[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg font-bold text-neutral-900">{user.name ?? user.email}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-neutral-100 text-neutral-600"}`}>
              {user.role.replace("_", " ")}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>
        </div>
        {isAdminUser && (
          <div className="shrink-0 rounded-xl bg-blue-50 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-blue-700">Admin User</p>
            <p className="mt-0.5 text-xs text-blue-500">Full access to everything</p>
          </div>
        )}
      </div>

      {isAdminUser ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm font-medium text-blue-800">This user has admin-level access and can manage all properties, venues, and menus without explicit access grants.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Page instructions */}
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold">How access works:</span> Grant property access first, then venue access becomes available, then menu access. Use the <span className="font-mono bg-neutral-100 px-1 rounded text-xs">V A E D</span> toggles to set permissions (View · Add · Edit · Delete).
            </p>
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
                    className="flex shrink-0 items-center text-neutral-400 hover:text-neutral-700"
                    title={isPropExpanded ? "Collapse" : "Expand"}
                  >
                    {isPropExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-600">
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
                        className="ml-1 rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                        title="Remove property access"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { toggleGrantForm(propGrantKey); setExpandedProps((p) => new Set([...p, prop.id])); }}
                      className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition"
                    >
                      <Plus className="size-3.5" /> Grant access
                    </button>
                  )}
                </div>

                {/* Property grant form */}
                {openGrantForms.has(propGrantKey) && !pAccess && (
                  <div className="border-t border-neutral-100 px-5 pb-4 pt-3">
                    <GrantForm
                      label={prop.name}
                      onGrant={(perms) => saveAccess("property", prop.id, perms)}
                      onCancel={() => toggleGrantForm(propGrantKey)}
                    />
                  </div>
                )}

                {/* Venues — only show if property access exists */}
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
                            {/* Venue row */}
                            <div className="flex items-center gap-3 px-4 py-3">
                              {vAccess && venue.menus.length > 0 ? (
                                <button
                                  onClick={() => setExpandedVenues((p) => { const n = new Set(p); if (n.has(venue.id)) n.delete(venue.id); else n.add(venue.id); return n; })}
                                  className="flex shrink-0 items-center text-neutral-400 hover:text-neutral-700"
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
                                    className="ml-1 rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { toggleGrantForm(venueGrantKey); setExpandedVenues((p) => new Set([...p, venue.id])); }}
                                  className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition"
                                >
                                  <Plus className="size-3" /> Grant
                                </button>
                              )}
                            </div>

                            {/* Venue grant form */}
                            {openGrantForms.has(venueGrantKey) && !vAccess && (
                              <div className="border-t border-neutral-100 px-4 pb-3 pt-2.5">
                                <GrantForm
                                  label={venue.name}
                                  onGrant={(perms) => saveAccess("venue", venue.id, perms)}
                                  onCancel={() => toggleGrantForm(venueGrantKey)}
                                />
                              </div>
                            )}

                            {/* Menus — only show if venue access exists */}
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
                                                className="ml-1 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                                              >
                                                <Trash2 className="size-3" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => toggleGrantForm(menuGrantKey)}
                                              className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 transition"
                                            >
                                              <Plus className="size-3" /> Grant
                                            </button>
                                          )}
                                        </div>
                                        {openGrantForms.has(menuGrantKey) && !mAccess && (
                                          <div className="border-t border-neutral-100 px-3.5 pb-3 pt-2">
                                            <GrantForm
                                              label={menu.name}
                                              onGrant={(perms) => saveAccess("menu", menu.id, perms)}
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

                {/* Locked state: property has no access, venues are hidden */}
                {isPropExpanded && !pAccess && (
                  <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Lock className="size-3.5" />
                      Grant property access above to unlock venue-level access
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

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}
        title="Remove access?"
        description={`Access to "${removeTarget?.name}" will be revoked. The user will no longer be able to perform actions on this ${removeTarget?.type}.`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        loading={removing}
      />
    </div>
  );
}

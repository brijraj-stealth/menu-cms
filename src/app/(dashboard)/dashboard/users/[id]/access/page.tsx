"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = "VIEW" | "ADD" | "EDIT" | "DELETE";
const ALL_PERMISSIONS: Permission[] = ["VIEW", "ADD", "EDIT", "DELETE"];

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface PropertyAccess {
  id: string;
  permissions: Permission[];
  property: { id: string; name: string; slug: string };
}

interface VenueAccess {
  id: string;
  permissions: Permission[];
  venue: { id: string; name: string; propertyId: string };
}

interface MenuAccess {
  id: string;
  permissions: Permission[];
  menu: { id: string; name: string; venueId: string };
}

interface Venue {
  id: string;
  name: string;
  propertyId: string;
  menus: { id: string; name: string; venueId: string }[];
}

interface Property {
  id: string;
  name: string;
  slug: string;
  venues: Venue[];
}

interface AccessData {
  user: UserInfo;
  properties: Property[];
  propertyAccess: PropertyAccess[];
  venueAccess: VenueAccess[];
  menuAccess: MenuAccess[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4 h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-muted" />
        <div>
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-6 rounded-xl border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="px-4 py-3">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Permission Checkbox Row ──────────────────────────────────────────────────

function PermissionCheckboxes({
  permissions,
  onChange,
}: {
  permissions: Permission[];
  onChange: (perms: Permission[]) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {ALL_PERMISSIONS.map((p) => {
        const checked = permissions.includes(p);
        return (
          <label key={p} className="flex cursor-pointer items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                const next = checked
                  ? permissions.filter((x) => x !== p)
                  : [...permissions, p];
                onChange(next);
              }}
              className="size-3.5 rounded accent-current"
            />
            {p}
          </label>
        );
      })}
    </div>
  );
}

// ─── Add Access Row ───────────────────────────────────────────────────────────

function AddAccessRow({
  label,
  options,
  existingIds,
  onAdd,
}: {
  label: string;
  options: { id: string; name: string }[];
  existingIds: string[];
  onAdd: (targetId: string, permissions: Permission[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(["VIEW"]);
  const [saving, setSaving] = useState(false);

  const available = options.filter((o) => !existingIds.includes(o.id));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add {label} access
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
      <Select value={targetId} onValueChange={(val) => val && setTargetId(val)}>
        <SelectTrigger size="sm" className="min-w-40">
          <SelectValue placeholder={`Select ${label}…`} />
        </SelectTrigger>
        <SelectContent>
          {available.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PermissionCheckboxes permissions={permissions} onChange={setPermissions} />
      <Button
        size="xs"
        disabled={!targetId || permissions.length === 0 || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(targetId, permissions);
          setTargetId("");
          setPermissions(["VIEW"]);
          setOpen(false);
          setSaving(false);
        }}
      >
        <Check className="size-3" />
        {saving ? "Saving…" : "Add"}
      </Button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Access Table ─────────────────────────────────────────────────────────────

function AccessTable<T extends { id: string; permissions: Permission[] }>({
  title,
  rows,
  getName,
  addLabel,
  addOptions,
  existingIds,
  onPermissionChange,
  onRemove,
  onAdd,
}: {
  title: string;
  rows: T[];
  getName: (row: T) => string;
  addLabel: string;
  addOptions: { id: string; name: string }[];
  existingIds: string[];
  onPermissionChange: (row: T, perms: Permission[]) => Promise<void>;
  onRemove: (row: T) => void;
  onAdd: (targetId: string, permissions: Permission[]) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border">
      <div className="flex items-center border-b bg-muted/30 px-4 py-3">
        <h3 className="font-medium">{title}</h3>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="divide-y">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-35 text-sm font-medium">
                {getName(row)}
              </span>
              <PermissionCheckboxes
                permissions={row.permissions}
                onChange={(perms) => onPermissionChange(row, perms)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(row)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No {title.toLowerCase()} access assigned.
          </div>
        )}
      </div>
      <div className="border-t px-2 py-2">
        <AddAccessRow
          label={addLabel}
          options={addOptions}
          existingIds={existingIds}
          onAdd={onAdd}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  STAFF: "bg-gray-100 text-gray-600",
};

export default function UserAccessPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/users/${id}/access`);
    const json = await res.json();
    if (json.data) setData(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveAccess(
    type: "property" | "venue" | "menu",
    targetId: string,
    permissions: Permission[]
  ) {
    if (permissions.length === 0) return;
    await fetch(`/api/users/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, targetId, permissions }),
    });
    fetchData();
    toast.success("Access updated");
  }

  async function handleRemoveAccess() {
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

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-destructive">
        User not found.
      </div>
    );
  }

  const { user, properties, propertyAccess, venueAccess, menuAccess } = data;

  const allVenues = properties.flatMap((p) => p.venues);
  const allMenus = allVenues.flatMap((v) => v.menus);

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/dashboard/users" />}
        className="-ml-2 mb-4"
      >
        <ArrowLeft className="size-4" />
        Users
      </Button>

      {/* User info */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold uppercase text-slate-700">
          {user.name?.[0] ?? user.email[0]}
        </div>
        <div>
          <h1 className="text-lg font-semibold">{user.name ?? user.email}</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                roleColors[user.role] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {user.role.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Property Access */}
        <AccessTable
          title="Property Access"
          rows={propertyAccess}
          getName={(r) => r.property.name}
          addLabel="property"
          addOptions={properties.map((p) => ({ id: p.id, name: p.name }))}
          existingIds={propertyAccess.map((r) => r.property.id)}
          onPermissionChange={(row, perms) =>
            saveAccess("property", row.property.id, perms)
          }
          onRemove={(row) =>
            setRemoveTarget({ type: "property", id: row.property.id, name: row.property.name })
          }
          onAdd={(targetId, perms) => saveAccess("property", targetId, perms)}
        />

        {/* Venue Access */}
        <AccessTable
          title="Venue Access"
          rows={venueAccess}
          getName={(r) => {
            const prop = properties.find((p) =>
              p.venues.some((v) => v.id === r.venue.id)
            );
            return prop ? `${prop.name} / ${r.venue.name}` : r.venue.name;
          }}
          addLabel="venue"
          addOptions={allVenues.map((v) => {
            const prop = properties.find((p) =>
              p.venues.some((vv) => vv.id === v.id)
            );
            return { id: v.id, name: prop ? `${prop.name} / ${v.name}` : v.name };
          })}
          existingIds={venueAccess.map((r) => r.venue.id)}
          onPermissionChange={(row, perms) =>
            saveAccess("venue", row.venue.id, perms)
          }
          onRemove={(row) =>
            setRemoveTarget({ type: "venue", id: row.venue.id, name: row.venue.name })
          }
          onAdd={(targetId, perms) => saveAccess("venue", targetId, perms)}
        />

        {/* Menu Access */}
        <AccessTable
          title="Menu Access"
          rows={menuAccess}
          getName={(r) => {
            const venue = allVenues.find((v) => v.id === r.menu.venueId);
            const prop = venue
              ? properties.find((p) =>
                  p.venues.some((v) => v.id === venue.id)
                )
              : null;
            return prop && venue
              ? `${prop.name} / ${venue.name} / ${r.menu.name}`
              : r.menu.name;
          }}
          addLabel="menu"
          addOptions={allMenus.map((m) => {
            const venue = allVenues.find((v) => v.id === m.venueId);
            const prop = venue
              ? properties.find((p) =>
                  p.venues.some((v) => v.id === venue.id)
                )
              : null;
            return {
              id: m.id,
              name: prop && venue ? `${prop.name} / ${venue.name} / ${m.name}` : m.name,
            };
          })}
          existingIds={menuAccess.map((r) => r.menu.id)}
          onPermissionChange={(row, perms) =>
            saveAccess("menu", row.menu.id, perms)
          }
          onRemove={(row) =>
            setRemoveTarget({ type: "menu", id: row.menu.id, name: row.menu.name })
          }
          onAdd={(targetId, perms) => saveAccess("menu", targetId, perms)}
        />
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}
        title="Remove access?"
        description={`Access to "${removeTarget?.name}" will be revoked. The user will no longer be able to perform actions on this ${removeTarget?.type}.`}
        confirmLabel="Remove"
        onConfirm={handleRemoveAccess}
        loading={removing}
      />
    </div>
  );
}

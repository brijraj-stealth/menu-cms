"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnVenue, canOnProperty } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenueInfo {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  isActive: boolean;
  propertyId: string;
  property: { id: string; name: string; slug: string };
}

interface Menu {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  venueId: string;
  _count: { categories: number };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="mb-8 rounded-xl border p-5">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="mb-2 flex animate-pulse items-center gap-4 rounded-xl border p-4">
          <div className="flex-1">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-2 h-3 w-48 rounded bg-muted" />
          </div>
          <div className="h-7 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── Menu Dialog ──────────────────────────────────────────────────────────────

function MenuDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: { name: string; description: string } | null;
  onSave: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { name: "", description: "" });
      setError(null);
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Menu" : "Add Menu"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g. Dinner Menu"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenuePage() {
  const { id, venueId } = useParams<{ id: string; venueId: string }>();
  const [me, setMe] = useState<MeData | null>(null);
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [editingVenue, setEditingVenue] = useState(false);
  const [venueForm, setVenueForm] = useState({ name: "", description: "", address: "" });
  const [venueSaving, setVenueSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    const [meRes, venueRes, menuRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/venues/${venueId}`, { cache: "no-store" }),
      fetch(`/api/menus?venueId=${venueId}`, { cache: "no-store" }),
    ]);
    const [meJson, venueJson, menuJson] = await Promise.all([
      meRes.json(), venueRes.json(), menuRes.json(),
    ]);
    if (meJson.data) setMe(meJson.data);
    if (venueJson.data) {
      setVenue(venueJson.data);
      setVenueForm({
        name: venueJson.data.name,
        description: venueJson.data.description ?? "",
        address: venueJson.data.address ?? "",
      });
    }
    if (menuJson.data) setMenus(menuJson.data);
    setLoading(false);
  }, [venueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    setVenueSaving(true);
    const res = await fetch(`/api/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(venueForm),
    });
    const json = await res.json();
    if (json.data) {
      setVenue(json.data);
      setEditingVenue(false);
      toast.success("Venue updated");
    } else {
      toast.error("Failed to update venue");
    }
    setVenueSaving(false);
  }

  async function createMenu(data: { name: string; description: string }) {
    const res = await fetch("/api/menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, venueId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create menu");
    setMenus((prev) => [...prev, json.data]);
    toast.success(`"${json.data.name}" created`);
  }

  async function updateMenu(data: { name: string; description: string }) {
    if (!editingMenu) return;
    const res = await fetch(`/api/menus/${editingMenu.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update menu");
    setMenus((prev) => prev.map((m) => (m.id === editingMenu.id ? { ...m, ...json.data } : m)));
    setEditingMenu(null);
    toast.success(`"${json.data.name}" updated`);
  }

  async function handleDeleteMenu() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/menus/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        toast.success(`"${deleteTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete menu");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!venue) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-destructive">Venue not found.</p>
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const canEditVenue = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
  const canAddMenu = me ? (isAdmin(me.role) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const canDeleteMenu = me ? isAdmin(me.role) : false;

  return (
    <div className="max-w-3xl">
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="-ml-2 mb-6">
        <ArrowLeft className="size-4" /> {venue.property.name}
      </Button>

      {/* Venue header */}
      <div className="mb-8 rounded-xl border p-5">
        {editingVenue ? (
          <form onSubmit={saveVenue} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Address</label>
              <Input value={venueForm.address} onChange={(e) => setVenueForm((f) => ({ ...f, address: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={venueForm.description} onChange={(e) => setVenueForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={venueSaving}>{venueSaving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setEditingVenue(false);
                setVenueForm({ name: venue.name, description: venue.description ?? "", address: venue.address ?? "" });
              }}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{venue.name}</h1>
              {venue.address && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" /> {venue.address}
                </p>
              )}
              {venue.description && <p className="mt-1 text-sm text-muted-foreground">{venue.description}</p>}
              <span className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${venue.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {venue.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {canEditVenue && (
              <Button variant="outline" size="sm" onClick={() => setEditingVenue(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Menus */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Menus
            <span className="ml-2 text-sm font-normal text-muted-foreground">({menus.length})</span>
          </h2>
          {canAddMenu && (
            <Button size="sm" onClick={() => { setEditingMenu(null); setMenuDialogOpen(true); }}>
              <Plus /> Add Menu
            </Button>
          )}
        </div>

        {menus.length === 0 ? (
          <div className="rounded-lg border border-dashed py-14 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No menus yet</p>
            {canAddMenu && (
              <Button size="sm" className="mt-4" onClick={() => { setEditingMenu(null); setMenuDialogOpen(true); }}>
                <Plus /> Add your first menu
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {menus.map((m) => {
              const canEdit = me ? (isAdmin(me.role) || canOnVenue(me, "EDIT", venueId) || canOnProperty(me, "EDIT", id)) : false;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.name}</p>
                    {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {m._count.categories} categor{m._count.categories !== 1 ? "ies" : "y"}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${m.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pl-4">
                    {canEdit && (
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditingMenu(m); setMenuDialogOpen(true); }}>
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                    {canDeleteMenu && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(m)} className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="xs"
                      render={<Link href={`/dashboard/properties/${id}/venues/${venueId}/menus/${m.id}`} />}
                      className="ml-1"
                    >
                      Open <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MenuDialog
        open={menuDialogOpen}
        onOpenChange={setMenuDialogOpen}
        initial={editingMenu ? { name: editingMenu.name, description: editingMenu.description ?? "" } : null}
        onSave={editingMenu ? updateMenu : createMenu}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete menu?"
        description={`"${deleteTarget?.name}" and all its categories and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteMenu}
        loading={deleting}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, MapPin, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnVenue, canOnProperty } from "@/lib/permissions";

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

const CARD_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-orange-500", "bg-rose-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500",
];
function cardColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CARD_COLORS[Math.abs(h) % CARD_COLORS.length];
}

function PageSkeleton() {
  return (
    <div>
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200">
        <div className="h-28 animate-pulse bg-neutral-100" />
        <div className="p-6">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-neutral-100" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-neutral-200">
            <div className="h-24 animate-pulse bg-neutral-100" />
            <div className="p-5">
              <div className="h-4 w-32 animate-pulse rounded-lg bg-neutral-100" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded-lg bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    if (open) { setForm(initial ?? { name: "", description: "" }); setError(null); }
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
          <DialogTitle>{initial ? "Edit Menu" : "Create New Menu"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Menu name *</label>
            <Input placeholder="e.g. Dinner Menu, Cocktail Menu" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <Input placeholder="Optional description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    const [meJson, venueJson, menuJson] = await Promise.all([meRes.json(), venueRes.json(), menuRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (venueJson.data) {
      setVenue(venueJson.data);
      setVenueForm({ name: venueJson.data.name, description: venueJson.data.description ?? "", address: venueJson.data.address ?? "" });
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
    if (json.data) { setVenue(json.data); setEditingVenue(false); toast.success("Venue updated"); }
    else toast.error("Failed to update venue");
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
      if (res.ok) { setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id)); toast.success(`"${deleteTarget.name}" deleted`); }
      else toast.error("Failed to delete menu");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!venue) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Venue not found.</p>
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const canEditVenue = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
  const canAddMenu = me ? (isAdmin(me.role) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const canDeleteMenu = me ? isAdmin(me.role) : false;
  const vColor = cardColor(venue.name);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="-ml-2 mb-6 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> {venue.property.name}
      </Button>

      {/* Venue header */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className={`relative flex h-28 items-center justify-center ${vColor}`}>
          <span className="text-5xl font-bold text-white/70 select-none">{venue.name[0]?.toUpperCase()}</span>
          <div className="absolute bottom-3 left-4">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${venue.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
              {venue.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="p-6">
          {editingVenue ? (
            <form onSubmit={saveVenue} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Name</label>
                <Input value={venueForm.name} onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Address</label>
                <Input value={venueForm.address} onChange={(e) => setVenueForm((f) => ({ ...f, address: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Description</label>
                <Input value={venueForm.description} onChange={(e) => setVenueForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={venueSaving} className="bg-neutral-900 text-white hover:bg-neutral-700">
                  {venueSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingVenue(false); setVenueForm({ name: venue.name, description: venue.description ?? "", address: venue.address ?? "" }); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">{venue.name}</h1>
                {venue.address && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="size-4 shrink-0" /> {venue.address}
                  </p>
                )}
                {venue.description && <p className="mt-1 text-sm text-neutral-500">{venue.description}</p>}
              </div>
              {canEditVenue && (
                <Button variant="outline" size="sm" onClick={() => setEditingVenue(true)} className="shrink-0">
                  <Pencil className="size-3.5" /> Edit Venue
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Menus section */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Menus</h2>
          <p className="text-sm text-neutral-500">
            {menus.length === 0 ? "No menus yet" : `${menus.length} menu${menus.length !== 1 ? "s" : ""} at this venue`}
          </p>
        </div>
        {canAddMenu && (
          <Button
            size="sm"
            onClick={() => { setEditingMenu(null); setMenuDialogOpen(true); }}
            className="h-9 gap-1.5 bg-neutral-900 px-4 text-white hover:bg-neutral-700"
          >
            <Plus className="size-4" /> Create Menu
          </Button>
        )}
      </div>

      {menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-20">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-neutral-200">
            <BookOpen className="size-7 text-neutral-500" />
          </div>
          <h3 className="mt-4 font-semibold text-neutral-900">No menus yet</h3>
          <p className="mt-1.5 max-w-xs text-center text-sm text-neutral-500">
            Menus contain categories and items. Create one to start building your menu.
          </p>
          {canAddMenu && (
            <Button
              onClick={() => { setEditingMenu(null); setMenuDialogOpen(true); }}
              className="mt-5 h-9 gap-1.5 bg-neutral-900 px-4 text-white hover:bg-neutral-700"
              size="sm"
            >
              <Plus className="size-4" /> Create your first menu
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {menus.map((m) => {
            const mColor = cardColor(m.name);
            const canEdit = me ? (isAdmin(me.role) || canOnVenue(me, "EDIT", venueId) || canOnProperty(me, "EDIT", id)) : false;
            return (
              <div key={m.id} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:border-neutral-400 hover:shadow-md">
                {/* Menu banner */}
                <div className={`relative flex h-24 items-center justify-center ${mColor}`}>
                  <BookOpen className="size-10 text-white/70" />
                  <div className="absolute bottom-2.5 left-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div
                    className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <button
                        onClick={() => { setEditingMenu(m); setMenuDialogOpen(true); }}
                        className="flex items-center justify-center rounded-lg bg-white/90 p-1.5 shadow hover:bg-white"
                      >
                        <Pencil className="size-3.5 text-neutral-600" />
                      </button>
                    )}
                    {canDeleteMenu && (
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="flex items-center justify-center rounded-lg bg-white/90 p-1.5 shadow hover:bg-white"
                      >
                        <Trash2 className="size-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Menu body */}
                <div className="p-5">
                  <h3 className="font-semibold text-neutral-900">{m.name}</h3>
                  {m.description && <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{m.description}</p>}

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
                    <Tag className="size-3.5" />
                    {m._count.categories} categor{m._count.categories !== 1 ? "ies" : "y"}
                  </div>

                  <div className="mt-4">
                    <Button
                      size="sm"
                      render={<Link href={`/dashboard/properties/${id}/venues/${venueId}/menus/${m.id}`} />}
                      className="w-full justify-center gap-1.5 bg-neutral-900 py-2 text-sm text-white hover:bg-neutral-700"
                    >
                      Edit Menu <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

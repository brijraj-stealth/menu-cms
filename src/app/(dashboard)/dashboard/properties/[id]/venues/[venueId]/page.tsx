"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, MapPin, Tag, Camera, Check, X } from "lucide-react";
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
  image: string | null;
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
      <div className="mb-8 overflow-hidden rounded-xl border border-neutral-200">
        <div className="h-32 animate-pulse bg-neutral-100" />
        <div className="p-5">
          <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-3.5 w-64 animate-pulse rounded bg-neutral-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="aspect-square animate-pulse bg-neutral-100" />
            <div className="p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuDialog({
  open, onOpenChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm({ name: "", description: "" }); setError(null); }
  }, [open]);

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
          <DialogTitle>Create New Menu</DialogTitle>
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
            <Button type="submit" disabled={submitting} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              {submitting ? "Creating…" : "Create Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VenuePage() {
  const { id, venueId } = useParams<{ id: string; venueId: string }>();
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [venueForm, setVenueForm] = useState({ name: "", description: "", address: "" });
  const [venueSaving, setVenueSaving] = useState(false);
  const [deleteVenueOpen, setDeleteVenueOpen] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  async function handleDeleteVenue() {
    setDeletingVenue(true);
    try {
      const res = await fetch(`/api/venues/${venueId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${venue?.name}" deleted`);
        router.push(`/dashboard/properties/${id}`);
      } else {
        toast.error("Failed to delete venue");
      }
    } finally {
      setDeletingVenue(false);
      setDeleteVenueOpen(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const toastId = toast.loading("Uploading image…");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadJson.error ?? "Upload failed", { id: toastId }); return; }
      const saveRes = await fetch(`/api/venues/${venueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadJson.url }),
      });
      if (!saveRes.ok) { toast.error("Failed to save image", { id: toastId }); return; }
      setVenue((prev) => prev ? { ...prev, image: uploadJson.url } : prev);
      toast.success("Image updated", { id: toastId });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleRemoveImage() {
    const toastId = toast.loading("Removing image…");
    const res = await fetch(`/api/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: null }),
    });
    if (res.ok) { setVenue((prev) => prev ? { ...prev, image: null } : prev); toast.success("Image removed", { id: toastId }); }
    else toast.error("Failed to remove image", { id: toastId });
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
  const canManageVenue = me ? isAdmin(me.role) : false;
  const canAddMenu = me ? (isAdmin(me.role) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const vColor = cardColor(venue.name);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="-ml-2 mb-5 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> {venue.property.name}
      </Button>

      {/* Venue header card */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
        <div className={`relative flex h-32 items-center justify-center overflow-hidden ${vColor}`}>
          {venue.image ? (
            <img src={venue.image} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <span className="select-none text-6xl font-bold text-white/60">{venue.name[0]?.toUpperCase()}</span>
          )}
          <div className="absolute bottom-3 left-4">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${venue.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
              {venue.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="p-5">
          {editingVenue ? (
            <form onSubmit={saveVenue} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <Camera className="size-3.5" />
                  {uploadingImage ? "Uploading…" : venue.image ? "Change Image" : "Upload Image"}
                </Button>
                {venue.image && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="h-7 gap-1.5 px-2.5 text-xs text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" /> Remove Image
                  </Button>
                )}
              </div>
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
                <Button type="submit" disabled={venueSaving} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  <Check className="size-3.5" /> {venueSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingVenue(false); setVenueForm({ name: venue.name, description: venue.description ?? "", address: venue.address ?? "" }); }}>
                  <X className="size-3.5" /> Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">{venue.name}</h1>
                {venue.address && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="size-3.5 shrink-0" /> {venue.address}
                  </p>
                )}
                {venue.description && <p className="mt-0.5 text-sm text-neutral-500">{venue.description}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {canEditVenue && (
                  <Button variant="outline" size="sm" onClick={() => setEditingVenue(true)} className="h-8 gap-1.5 px-3 text-[13px]">
                    <Pencil className="size-3.5" /> Edit Venue
                  </Button>
                )}
                {canManageVenue && (
                  <Button variant="outline" size="sm" onClick={() => setDeleteVenueOpen(true)} className="h-8 gap-1.5 px-3 text-[13px] text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-3.5" /> Delete Venue
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menus section */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Menus</h2>
          <p className="text-sm text-neutral-500">
            {menus.length === 0 ? "No menus yet" : `${menus.length} menu${menus.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canAddMenu && (
          <Button onClick={() => setMenuDialogOpen(true)} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
            <Plus className="size-3.5" /> Create Menu
          </Button>
        )}
      </div>

      {menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-16">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <BookOpen className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No menus yet</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-400">
            Create a menu to start building categories and items.
          </p>
          {canAddMenu && (
            <Button onClick={() => setMenuDialogOpen(true)} className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              <Plus className="size-3.5" /> Create your first menu
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {menus.map((m) => {
            const mColor = cardColor(m.name);
            return (
              <div key={m.id} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
                {/* Square menu image */}
                <div className={`relative aspect-square flex items-center justify-center ${mColor}`}>
                  <BookOpen className="size-14 text-white/50" />
                  <div className="absolute bottom-3 left-3">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${m.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Menu body */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">{m.name}</h3>
                  {m.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{m.description}</p>}
                  <div className="mt-2 flex items-center gap-1 text-xs text-neutral-400">
                    <Tag className="size-3" />
                    {m._count.categories} categor{m._count.categories !== 1 ? "ies" : "y"}
                  </div>
                  <div className="mt-3">
                    <Button
                      render={<Link href={`/dashboard/properties/${id}/venues/${venueId}/menus/${m.id}`} />}
                      className="h-8 w-full gap-1.5 bg-neutral-900 text-[13px] text-white hover:bg-neutral-800"
                    >
                      <Pencil className="size-3.5" /> Edit Menu
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />

      <MenuDialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen} onSave={createMenu} />

      <ConfirmDialog
        open={deleteVenueOpen}
        onOpenChange={(v) => { if (!v) setDeleteVenueOpen(false); }}
        title="Delete venue?"
        description={`"${venue.name}" and all its menus and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteVenue}
        loading={deletingVenue}
      />
    </div>
  );
}

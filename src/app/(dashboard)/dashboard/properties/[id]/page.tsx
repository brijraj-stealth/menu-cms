"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, MapPin, BookOpen, Camera, Tag, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnProperty } from "@/lib/permissions";

interface Property {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  logo: string | null;
  isActive: boolean;
}

interface Venue {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  image: string | null;
  isActive: boolean;
  propertyId: string;
  _count: { menus: number };
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
      <div className="mb-5 h-7 w-24 animate-pulse rounded bg-neutral-100" />
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200">
        <div className="h-32 animate-pulse bg-neutral-100" />
        <div className="p-5">
          <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-3.5 w-64 animate-pulse rounded bg-neutral-100" />
        </div>
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="mb-4 overflow-hidden rounded-xl border border-neutral-200">
          <div className="h-16 animate-pulse bg-neutral-100" />
          <div className="p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
            <div className="mt-3 h-8 w-full animate-pulse rounded bg-neutral-100" />
            <div className="mt-2 h-8 w-full animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VenueDialog({
  open, onOpenChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { name: string; description: string; address: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm({ name: "", description: "", address: "" }); setError(null); }
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
          <DialogTitle>Add New Venue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Venue name *</label>
            <Input placeholder="e.g. Main Restaurant" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Address</label>
            <Input placeholder="e.g. Ground Floor, Block A" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <Input placeholder="Optional description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              {submitting ? "Creating…" : "Create Venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<MeData | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [menusMap, setMenusMap] = useState<Record<string, Menu[]>>({});
  const [loading, setLoading] = useState(true);

  // Property edit
  const [editingProperty, setEditingProperty] = useState(false);
  const [propForm, setPropForm] = useState({ name: "", description: "" });
  const [propSaving, setPropSaving] = useState(false);

  // Property image
  const [uploadingProp, setUploadingProp] = useState(false);
  const propImageInputRef = useRef<HTMLInputElement>(null);

  // Delete targets
  const [deletePropertyOpen, setDeletePropertyOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);

  // Venue inline editing
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [venueFormMap, setVenueFormMap] = useState<Record<string, { name: string; description: string; address: string }>>({});
  const [venueSavingId, setVenueSavingId] = useState<string | null>(null);

  // Dialogs
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [menuDialogVenueId, setMenuDialogVenueId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [meRes, propRes, venueRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/properties/${id}`, { cache: "no-store" }),
      fetch(`/api/venues?propertyId=${id}`, { cache: "no-store" }),
    ]);
    const [meJson, propJson, venueJson] = await Promise.all([meRes.json(), propRes.json(), venueRes.json()]);

    if (meJson.data) setMe(meJson.data);
    if (propJson.data) {
      setProperty(propJson.data);
      setPropForm({ name: propJson.data.name, description: propJson.data.description ?? "" });
    }

    if (venueJson.data) {
      const venueData: Venue[] = venueJson.data;
      setVenues(venueData);

      const formMap: Record<string, { name: string; description: string; address: string }> = {};
      venueData.forEach((v) => {
        formMap[v.id] = { name: v.name, description: v.description ?? "", address: v.address ?? "" };
      });
      setVenueFormMap(formMap);

      if (venueData.length > 0) {
        const menuResponses = await Promise.all(
          venueData.map((v) => fetch(`/api/menus?venueId=${v.id}`, { cache: "no-store" }))
        );
        const menuJsons = await Promise.all(menuResponses.map((r) => r.json()));
        const map: Record<string, Menu[]> = {};
        venueData.forEach((v, i) => { map[v.id] = menuJsons[i].data ?? []; });
        setMenusMap(map);
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Property handlers ---
  async function saveProperty(e: React.FormEvent) {
    e.preventDefault();
    setPropSaving(true);
    const res = await fetch(`/api/properties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(propForm),
    });
    const json = await res.json();
    if (json.data) { setProperty(json.data); setEditingProperty(false); toast.success("Property updated"); }
    else toast.error("Failed to update property");
    setPropSaving(false);
  }

  async function handleDeleteProperty() {
    setDeletingProperty(true);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success(`"${property?.name}" deleted`); router.push("/dashboard/properties"); }
      else toast.error("Failed to delete property");
    } finally {
      setDeletingProperty(false);
      setDeletePropertyOpen(false);
    }
  }

  async function handlePropImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProp(true);
    const toastId = toast.loading("Uploading image…");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadJson.error ?? "Upload failed", { id: toastId }); return; }
      const saveRes = await fetch(`/api/properties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: uploadJson.url }),
      });
      if (!saveRes.ok) { toast.error("Failed to save image", { id: toastId }); return; }
      setProperty((prev) => prev ? { ...prev, logo: uploadJson.url } : prev);
      toast.success("Image updated", { id: toastId });
    } finally {
      setUploadingProp(false);
      e.target.value = "";
    }
  }

  async function handleRemovePropLogo() {
    const toastId = toast.loading("Removing image…");
    const res = await fetch(`/api/properties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo: null }),
    });
    if (res.ok) { setProperty((p) => p ? { ...p, logo: null } : p); toast.success("Image removed", { id: toastId }); }
    else toast.error("Failed to remove image", { id: toastId });
  }

  // --- Venue handlers ---
  async function createVenue(data: { name: string; description: string; address: string }) {
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, propertyId: id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create venue");
    const newVenue: Venue = json.data;
    setVenues((prev) => [...prev, newVenue]);
    setVenueFormMap((prev) => ({ ...prev, [newVenue.id]: { name: newVenue.name, description: newVenue.description ?? "", address: newVenue.address ?? "" } }));
    setMenusMap((prev) => ({ ...prev, [newVenue.id]: [] }));
    toast.success(`"${newVenue.name}" created`);
  }

  async function saveVenue(venueId: string) {
    const form = venueFormMap[venueId];
    if (!form) return;
    setVenueSavingId(venueId);
    const res = await fetch(`/api/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.data) {
      setVenues((prev) => prev.map((v) => v.id === venueId ? json.data : v));
      setEditingVenueId(null);
      toast.success("Venue updated");
    } else {
      toast.error("Failed to update venue");
    }
    setVenueSavingId(null);
  }

  async function handleDeleteVenue() {
    if (!deleteVenueTarget) return;
    setDeletingVenue(true);
    try {
      const res = await fetch(`/api/venues/${deleteVenueTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setVenues((prev) => prev.filter((v) => v.id !== deleteVenueTarget.id));
        setMenusMap((prev) => { const m = { ...prev }; delete m[deleteVenueTarget.id]; return m; });
        toast.success(`"${deleteVenueTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete venue");
      }
    } finally {
      setDeletingVenue(false);
      setDeleteVenueTarget(null);
    }
  }

  // --- Menu handlers ---
  async function createMenu(venueId: string, data: { name: string; description: string }) {
    const res = await fetch("/api/menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, venueId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create menu");
    setMenusMap((prev) => ({ ...prev, [venueId]: [...(prev[venueId] ?? []), json.data] }));
    toast.success(`"${json.data.name}" created`);
  }

  async function handleDeleteMenu() {
    if (!deleteMenuTarget) return;
    setDeletingMenu(true);
    try {
      const res = await fetch(`/api/menus/${deleteMenuTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        const venueId = deleteMenuTarget.venueId;
        setMenusMap((prev) => ({ ...prev, [venueId]: (prev[venueId] ?? []).filter((m) => m.id !== deleteMenuTarget.id) }));
        toast.success(`"${deleteMenuTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete menu");
      }
    } finally {
      setDeletingMenu(false);
      setDeleteMenuTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!property) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Property not found.</p>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/properties" />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const canEditProp = me ? canOnProperty(me, "EDIT", id) : false;
  const canManageProp = me ? isAdmin(me.role) : false;
  const canAddVenue = me ? (isAdmin(me.role) || canOnProperty(me, "ADD", id)) : false;
  const propColor = cardColor(property.name);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard/properties" />} className="-ml-2 mb-5 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> All Properties
      </Button>

      {/* Property header card */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
        <div className={`relative flex h-32 items-center justify-center overflow-hidden ${propColor}`}>
          {property.logo ? (
            <img src={property.logo} alt={property.name} className="h-full w-full object-cover" />
          ) : (
            <span className="select-none text-6xl font-bold text-white/60">{property.name[0]?.toUpperCase()}</span>
          )}
          <div className="absolute bottom-3 left-4">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${property.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
              {property.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="p-5">
          {editingProperty ? (
            <form onSubmit={saveProperty} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => propImageInputRef.current?.click()}
                  disabled={uploadingProp}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <Camera className="size-3.5" />
                  {uploadingProp ? "Uploading…" : property.logo ? "Change Image" : "Upload Image"}
                </Button>
                {property.logo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemovePropLogo}
                    className="h-7 gap-1.5 px-2.5 text-xs text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" /> Remove Image
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Name</label>
                <Input value={propForm.name} onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Description</label>
                <Input value={propForm.description} onChange={(e) => setPropForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={propSaving} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  <Check className="size-3.5" /> {propSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingProperty(false); setPropForm({ name: property.name, description: property.description ?? "" }); }}>
                  <X className="size-3.5" /> Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">{property.name}</h1>
                {property.description && <p className="mt-0.5 text-sm text-neutral-500">{property.description}</p>}
                <p className="mt-1 font-mono text-[11px] text-neutral-400">{property.slug}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canEditProp && (
                  <Button variant="outline" size="sm" onClick={() => setEditingProperty(true)} className="h-8 gap-1.5 px-3 text-[13px]">
                    <Pencil className="size-3.5" /> Edit Property
                  </Button>
                )}
                {canManageProp && (
                  <Button variant="outline" size="sm" onClick={() => setDeletePropertyOpen(true)} className="h-8 gap-1.5 px-3 text-[13px] text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-3.5" /> Delete Property
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Venues & Menus */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Venues &amp; Menus</h2>
          <p className="text-sm text-neutral-500">
            {venues.length === 0 ? "No venues yet" : `${venues.length} venue${venues.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canAddVenue && (
          <Button onClick={() => setVenueDialogOpen(true)} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
            <Plus className="size-3.5" /> Add Venue
          </Button>
        )}
      </div>

      {venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-16">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <MapPin className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No venues yet</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-400">
            Venues are physical locations within this property.
          </p>
          {canAddVenue && (
            <Button onClick={() => setVenueDialogOpen(true)} className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              <Plus className="size-3.5" /> Add your first venue
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {venues.map((v) => {
            const vColor = cardColor(v.name);
            const canEditV = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
            const canManageV = me ? isAdmin(me.role) : false;
            const canAddMenu = me ? (isAdmin(me.role) || canOnProperty(me, "ADD", id)) : false;
            const vMenus = menusMap[v.id] ?? [];
            const isEditingV = editingVenueId === v.id;

            return (
              <div key={v.id} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
                {/* Venue color strip */}
                <div className={`flex h-14 items-center gap-3 px-5 ${vColor}`}>
                  <span className="select-none text-2xl font-bold text-white/80">{v.name[0]?.toUpperCase()}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${v.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                    {v.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="p-4">
                  {/* Venue info / edit form */}
                  {isEditingV ? (
                    <form
                      onSubmit={async (e) => { e.preventDefault(); await saveVenue(v.id); }}
                      className="flex flex-col gap-3 border-b border-neutral-100 pb-4 mb-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-neutral-700">Venue name</label>
                        <Input
                          value={venueFormMap[v.id]?.name ?? ""}
                          onChange={(e) => setVenueFormMap((prev) => ({ ...prev, [v.id]: { ...prev[v.id], name: e.target.value } }))}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-neutral-700">Address</label>
                        <Input
                          value={venueFormMap[v.id]?.address ?? ""}
                          onChange={(e) => setVenueFormMap((prev) => ({ ...prev, [v.id]: { ...prev[v.id], address: e.target.value } }))}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-neutral-700">Description</label>
                        <Input
                          value={venueFormMap[v.id]?.description ?? ""}
                          onChange={(e) => setVenueFormMap((prev) => ({ ...prev, [v.id]: { ...prev[v.id], description: e.target.value } }))}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={venueSavingId === v.id} className="h-7 gap-1.5 bg-neutral-900 px-3 text-xs text-white hover:bg-neutral-800">
                          <Check className="size-3" /> {venueSavingId === v.id ? "Saving…" : "Save Venue"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingVenueId(null);
                            setVenueFormMap((prev) => ({ ...prev, [v.id]: { name: v.name, description: v.description ?? "", address: v.address ?? "" } }));
                          }}
                          className="h-7 gap-1 text-xs"
                        >
                          <X className="size-3" /> Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900">{v.name}</h3>
                        {v.address && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                            <MapPin className="size-3 shrink-0" /> {v.address}
                          </p>
                        )}
                        {v.description && <p className="mt-0.5 text-xs text-neutral-400">{v.description}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {canEditV && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingVenueId(v.id)}
                            className="h-7 gap-1 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                          >
                            <Pencil className="size-3" /> Edit Venue
                          </Button>
                        )}
                        {canManageV && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteVenueTarget(v)}
                            className="h-7 gap-1 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-3" /> Delete Venue
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Menus list */}
                  <div>
                    {vMenus.length === 0 ? (
                      <p className="mb-3 text-xs text-neutral-400">No menus in this venue yet.</p>
                    ) : (
                      <div className="mb-2 flex flex-col divide-y divide-neutral-100">
                        {vMenus.map((m) => (
                          <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <BookOpen className="size-3.5 shrink-0 text-neutral-400" />
                              <span className="truncate text-sm font-medium text-neutral-800">{m.name}</span>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                                {m.isActive ? "Active" : "Inactive"}
                              </span>
                              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-400">
                                <Tag className="size-3" /> {m._count.categories}
                              </span>
                            </div>
                            <div className="ml-3 flex shrink-0 items-center gap-1.5">
                              <Button
                                size="sm"
                                render={<Link href={`/dashboard/properties/${id}/venues/${v.id}/menus/${m.id}`} />}
                                className="h-7 gap-1.5 bg-neutral-900 px-2.5 text-xs text-white hover:bg-neutral-800"
                              >
                                <Pencil className="size-3" /> Edit Menu
                              </Button>
                              {canManageV && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteMenuTarget(m)}
                                  className="h-7 w-7 p-0 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                  title="Delete this menu permanently"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {canAddMenu && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuDialogVenueId(v.id)}
                        className="h-7 gap-1.5 px-2 text-xs text-neutral-500 hover:text-neutral-900"
                      >
                        <Plus className="size-3" /> Create Menu
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={propImageInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePropImageChange} />

      <VenueDialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen} onSave={createVenue} />

      {menuDialogVenueId && (
        <MenuDialog
          open={!!menuDialogVenueId}
          onOpenChange={(v) => { if (!v) setMenuDialogVenueId(null); }}
          onSave={(data) => createMenu(menuDialogVenueId, data)}
        />
      )}

      <ConfirmDialog
        open={deletePropertyOpen}
        onOpenChange={(v) => { if (!v) setDeletePropertyOpen(false); }}
        title="Delete property?"
        description={`"${property.name}" and all its venues, menus, and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteProperty}
        loading={deletingProperty}
      />
      <ConfirmDialog
        open={!!deleteVenueTarget}
        onOpenChange={(v) => { if (!v) setDeleteVenueTarget(null); }}
        title="Delete venue?"
        description={`"${deleteVenueTarget?.name}" and all its menus and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteVenue}
        loading={deletingVenue}
      />
      <ConfirmDialog
        open={!!deleteMenuTarget}
        onOpenChange={(v) => { if (!v) setDeleteMenuTarget(null); }}
        title="Delete menu?"
        description={`"${deleteMenuTarget?.name}" and all its categories and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteMenu}
        loading={deletingMenu}
      />
    </div>
  );
}

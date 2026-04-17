"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Camera, Check, X, MoreHorizontal, Eye, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnProperty } from "@/lib/permissions";

interface Property {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  slug: string;
  logo: string | null;
  isActive: boolean;
  sequenceNumber: number;
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
  isActive: boolean;
  venueId: string;
  _count: { categories: number };
  itemsCount: number;
}

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-1 h-3.5 w-24 rounded bg-neutral-100" />
      <div className="mb-2 h-7 w-64 rounded bg-neutral-100" />
      <div className="mb-6 h-4 w-32 rounded bg-neutral-100" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="aspect-video bg-neutral-100" />
            <div className="p-4">
              <div className="h-4 w-32 rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-20 rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditPropertyDialog({
  open, onOpenChange, property, onSave, onUploadImage, onRemoveImage, uploading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  property: Property;
  onSave: (data: { name: string; description: string; location: string }) => Promise<void>;
  onUploadImage: () => void;
  onRemoveImage: () => void;
  uploading: boolean;
}) {
  const [form, setForm] = useState({ name: property.name, description: property.description ?? "", location: property.location ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: property.name, description: property.description ?? "", location: property.location ?? "" });
      setError(null);
    }
  }, [open, property]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Property</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Photo preview */}
          <div>
            <div
              onClick={!uploading ? onUploadImage : undefined}
              className={`group relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 transition-colors ${property.logo ? "border-neutral-200" : "border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-300"}`}
            >
              {property.logo ? (
                <>
                  <img src={property.logo} alt="Property photo" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white"><Camera className="size-3.5" /> Change photo</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <Camera className="size-6" />
                  <span className="text-xs">{uploading ? "Uploading…" : "Click to upload photo"}</span>
                </div>
              )}
              {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><span className="text-xs text-neutral-500">Uploading…</span></div>}
            </div>
            {property.logo && !uploading && (
              <button type="button" onClick={onRemoveImage} className="mt-1.5 text-xs text-red-500 hover:text-red-700">Remove photo</button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Location</label>
            <Input placeholder="e.g. Monterey, CA" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <Input placeholder="Optional" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              <Check className="size-3.5" />{saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddVenueDialog({
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
        <DialogHeader><DialogTitle>Add New Venue</DialogTitle></DialogHeader>
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
            <Input placeholder="e.g. Cocktail Bar, BBQ" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<MeData | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [menusMap, setMenusMap] = useState<Record<string, Menu[]>>({});
  const [loading, setLoading] = useState(true);

  const [editPropertyOpen, setEditPropertyOpen] = useState(false);
  const [uploadingProp, setUploadingProp] = useState(false);
  const propImageInputRef = useRef<HTMLInputElement>(null);

  const [deletePropertyOpen, setDeletePropertyOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    const [meRes, propRes, venueRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/properties/${id}`, { cache: "no-store" }),
      fetch(`/api/venues?propertyId=${id}`, { cache: "no-store" }),
    ]);
    const [meJson, propJson, venueJson] = await Promise.all([meRes.json(), propRes.json(), venueRes.json()]);

    if (meJson.data) setMe(meJson.data);
    if (propJson.data) setProperty(propJson.data);

    if (venueJson.data) {
      const venueData: Venue[] = venueJson.data;
      setVenues(venueData);

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

  async function saveProperty(data: { name: string; description: string; location: string }) {
    const res = await fetch(`/api/properties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.data) { setProperty((prev) => prev ? { ...prev, ...json.data } : prev); toast.success("Property updated"); }
    else throw new Error(json.error ?? "Failed to update");
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

  async function createVenue(data: { name: string; description: string; address: string }) {
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, propertyId: id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create venue");
    setVenues((prev) => [...prev, json.data]);
    setMenusMap((prev) => ({ ...prev, [json.data.id]: [] }));
    toast.success(`"${json.data.name}" created`);
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

  if (loading) return <PageSkeleton />;

  if (!property) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Property not found.</p>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/properties" />} className="mt-4">Back</Button>
      </div>
    );
  }

  const canEditProp = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
  const canManageProp = me ? isAdmin(me.role) : false;
  const canAddVenue = me ? (isAdmin(me.role) || canOnProperty(me, "ADD", id)) : false;
  const isReadOnly = !canEditProp;
  const roleLabel = me?.role === "SUPER_ADMIN" ? "Super Admin" : me?.role === "ADMIN" ? "Admin" : "Staff";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[12px] text-neutral-400">
            Property · p{property.sequenceNumber}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold text-neutral-900">{property.name}</h1>
          {property.location && (
            <p className="mt-1 text-sm text-neutral-500">{property.location}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/dashboard/audit-log" />}
            className="h-8 gap-1.5 px-3 text-[13px]"
          >
            <History className="size-3.5" /> History
          </Button>
          {canEditProp && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditPropertyOpen(true)}
              className="h-8 gap-1.5 px-3 text-[13px]"
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
          {canManageProp && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletePropertyOpen(true)}
              className="h-8 gap-1.5 px-3 text-[13px] text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Eye className="size-4 shrink-0 text-amber-600" />
          <p className="text-[13px] text-amber-700">
            You&apos;re signed in as <strong>{roleLabel}</strong> — read-only access.
          </p>
        </div>
      )}

      {/* Venues section */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Venues</h2>
          <p className="text-[13px] text-neutral-500">
            {venues.length === 0 ? "No venues yet" : `${venues.length} venue${venues.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canAddVenue && (
          <Button
            onClick={() => setVenueDialogOpen(true)}
            className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
          >
            <Plus className="size-3.5" /> Add Venue
          </Button>
        )}
      </div>

      {venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-16">
          <h3 className="text-sm font-semibold text-neutral-900">No venues yet</h3>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {venues.map((v) => {
            const vMenus = menusMap[v.id] ?? [];
            const itemCount = vMenus.reduce((a, m) => a + (m.itemsCount ?? 0), 0);
            return (
              <div key={v.id} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
                {/* Photo area */}
                <Link href={`/dashboard/properties/${id}/venues/${v.id}`}>
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-neutral-100">
                    {v.image ? (
                      <img src={v.image} alt={v.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Camera className="size-5 text-neutral-300" />
                        <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-300">
                          Venue Photo · {v.name.toUpperCase()}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/properties/${id}/venues/${v.id}`} className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold text-neutral-900 hover:underline">
                        {v.name}
                      </h3>
                      {v.description && (
                        <p className="mt-0.5 truncate text-[12px] text-neutral-400">{v.description}</p>
                      )}
                    </Link>
                    {canManageProp && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0 text-neutral-400 hover:text-neutral-700">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem render={<Link href={`/dashboard/properties/${id}/venues/${v.id}`} />}>
                            Open Venue
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                            onClick={() => setDeleteVenueTarget(v)}
                          >
                            <Trash2 className="size-3.5" /> Delete Venue
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-neutral-400">
                    {vMenus.length} menu{vMenus.length !== 1 ? "s" : ""} &nbsp;·&nbsp; {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={propImageInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePropImageChange} />

      <EditPropertyDialog
        open={editPropertyOpen}
        onOpenChange={setEditPropertyOpen}
        property={property}
        onSave={saveProperty}
        onUploadImage={() => propImageInputRef.current?.click()}
        onRemoveImage={handleRemovePropLogo}
        uploading={uploadingProp}
      />

      <AddVenueDialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen} onSave={createVenue} />

      <ConfirmDialog
        open={deletePropertyOpen}
        onOpenChange={(v) => { if (!v) setDeletePropertyOpen(false); }}
        title="Delete property?"
        description={`"${property.name}" and all its venues, menus, and items will be permanently deleted.`}
        onConfirm={handleDeleteProperty}
        loading={deletingProperty}
      />
      <ConfirmDialog
        open={!!deleteVenueTarget}
        onOpenChange={(v) => { if (!v) setDeleteVenueTarget(null); }}
        title="Delete venue?"
        description={`"${deleteVenueTarget?.name}" and all its menus and items will be permanently deleted.`}
        onConfirm={handleDeleteVenue}
        loading={deletingVenue}
      />
    </div>
  );
}

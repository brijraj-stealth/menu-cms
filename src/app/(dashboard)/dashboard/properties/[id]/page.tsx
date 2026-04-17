"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, ChevronRight, BookOpen, Camera } from "lucide-react";
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
        <div className="h-24 animate-pulse bg-neutral-100" />
        <div className="p-5">
          <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-3.5 w-64 animate-pulse rounded bg-neutral-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="h-20 animate-pulse bg-neutral-100" />
            <div className="p-4">
              <div className="h-3.5 w-32 animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: { name: string; description: string; address: string } | null;
  onSave: (data: { name: string; description: string; address: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm(initial ?? { name: "", description: "", address: "" }); setError(null); }
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
          <DialogTitle>{initial ? "Edit Venue" : "Add New Venue"}</DialogTitle>
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
            <Button type="submit" disabled={submitting} className="h-8 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<MeData | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [editingProperty, setEditingProperty] = useState(false);
  const [propForm, setPropForm] = useState({ name: "", description: "" });
  const [propSaving, setPropSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingProp, setUploadingProp] = useState(false);
  const [uploadingVenueId, setUploadingVenueId] = useState<string | null>(null);
  const propImageInputRef = useRef<HTMLInputElement>(null);
  const venueImageInputRef = useRef<HTMLInputElement>(null);
  const pendingVenueUploadIdRef = useRef<string | null>(null);

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
    if (venueJson.data) setVenues(venueJson.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  async function createVenue(data: { name: string; description: string; address: string }) {
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, propertyId: id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create venue");
    setVenues((prev) => [...prev, json.data]);
    toast.success(`"${json.data.name}" created`);
  }

  async function updateVenue(data: { name: string; description: string; address: string }) {
    if (!editingVenue) return;
    const res = await fetch(`/api/venues/${editingVenue.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update venue");
    setVenues((prev) => prev.map((v) => (v.id === editingVenue.id ? json.data : v)));
    setEditingVenue(null);
    toast.success(`"${json.data.name}" updated`);
  }

  async function handleDeleteVenue() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/venues/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setVenues((prev) => prev.filter((v) => v.id !== deleteTarget.id)); toast.success(`"${deleteTarget.name}" deleted`); }
      else toast.error("Failed to delete venue");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!property) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Property not found.</p>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
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

  async function handleVenueImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const venueId = pendingVenueUploadIdRef.current;
    if (!file || !venueId) return;
    setUploadingVenueId(venueId);
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
      setVenues((prev) => prev.map((v) => v.id === venueId ? { ...v, image: uploadJson.url } : v));
      toast.success("Image updated", { id: toastId });
    } finally {
      setUploadingVenueId(null);
      pendingVenueUploadIdRef.current = null;
      e.target.value = "";
    }
  }

  async function handleRemoveVenueImage(venueId: string) {
    const toastId = toast.loading("Removing image…");
    const res = await fetch(`/api/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: null }),
    });
    if (res.ok) {
      setVenues((prev) => prev.map((v) => v.id === venueId ? { ...v, image: null } : v));
      toast.success("Image removed", { id: toastId });
    } else {
      toast.error("Failed to remove image", { id: toastId });
    }
  }

  const canEditProp = me ? canOnProperty(me, "EDIT", id) : false;
  const canAddVenue = me ? (isAdmin(me.role) || canOnProperty(me, "ADD", id)) : false;
  const canDeleteVenue = me ? isAdmin(me.role) : false;
  const propColor = cardColor(property.name);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard" />} className="-ml-2 mb-5 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> All Properties
      </Button>

      {/* Property header card */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
        {/* Banner */}
        <div className={`group/banner relative flex h-24 items-center justify-center overflow-hidden ${propColor}`}>
          {property.logo ? (
            <img src={property.logo} alt={property.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-5xl font-bold text-white/70 select-none">{property.name[0]?.toUpperCase()}</span>
          )}
          {canEditProp && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover/banner:bg-black/25">
              <button
                onClick={() => propImageInputRef.current?.click()}
                disabled={uploadingProp}
                className="flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 opacity-0 transition-opacity hover:bg-white group-hover/banner:opacity-100 disabled:opacity-50"
              >
                <Camera className="size-3.5" />
                {uploadingProp ? "Uploading…" : property.logo ? "Change Image" : "Add Image"}
              </button>
              {property.logo && (
                <button
                  onClick={async () => {
                    const toastId = toast.loading("Removing image…");
                    const res = await fetch(`/api/properties/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logo: null }) });
                    if (res.ok) { setProperty((p) => p ? { ...p, logo: null } : p); toast.success("Image removed", { id: toastId }); }
                    else toast.error("Failed to remove image", { id: toastId });
                  }}
                  className="rounded-md bg-white/90 p-1 opacity-0 transition-opacity hover:bg-white group-hover/banner:opacity-100"
                >
                  <Trash2 className="size-3.5 text-red-500" />
                </button>
              )}
            </div>
          )}
          <div className="absolute bottom-3 left-4">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${property.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
              {property.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-5">
          {editingProperty ? (
            <form onSubmit={saveProperty} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Name</label>
                <Input value={propForm.name} onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Description</label>
                <Input value={propForm.description} onChange={(e) => setPropForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={propSaving} className="h-8 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  {propSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingProperty(false); setPropForm({ name: property.name, description: property.description ?? "" }); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">{property.name}</h1>
                {property.description && (
                  <p className="mt-0.5 text-sm text-neutral-500">{property.description}</p>
                )}
                <p className="mt-1 font-mono text-[11px] text-neutral-400">{property.slug}</p>
              </div>
              {canEditProp && (
                <Button variant="outline" size="sm" onClick={() => setEditingProperty(true)} className="h-8 shrink-0 px-3 text-[13px]">
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Venues section */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Venues</h2>
          <p className="text-sm text-neutral-500">
            {venues.length === 0 ? "No venues yet" : `${venues.length} venue${venues.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canAddVenue && (
          <Button
            size="sm"
            onClick={() => { setEditingVenue(null); setVenueDialogOpen(true); }}
            className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
          >
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
            Venues are physical locations within this property (e.g., restaurant, bar, rooftop).
          </p>
          {canAddVenue && (
            <Button
              onClick={() => { setEditingVenue(null); setVenueDialogOpen(true); }}
              className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
              size="sm"
            >
              <Plus className="size-3.5" /> Add your first venue
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {venues.map((v) => {
            const vColor = cardColor(v.name);
            const canEdit = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
            return (
              <div key={v.id} className="group overflow-hidden rounded-xl border border-neutral-200/80 bg-white transition-colors duration-150 hover:border-neutral-300">
                {/* Venue banner */}
                <div className={`relative flex h-20 items-center justify-center overflow-hidden ${vColor}`}>
                  {v.image ? (
                    <img src={v.image} alt={v.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white/60 select-none">{v.name[0]?.toUpperCase()}</span>
                  )}
                  {canEdit && (
                    <div
                      className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover:bg-black/20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { pendingVenueUploadIdRef.current = v.id; venueImageInputRef.current?.click(); }}
                        disabled={uploadingVenueId === v.id}
                        className="flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 disabled:opacity-50"
                      >
                        <Camera className="size-3" />
                        {uploadingVenueId === v.id ? "Uploading…" : v.image ? "Change" : "Add Image"}
                      </button>
                      {v.image && (
                        <button
                          onClick={() => handleRemoveVenueImage(v.id)}
                          className="rounded-md bg-white/90 p-1 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                        >
                          <Trash2 className="size-3 text-red-500" />
                        </button>
                      )}
                    </div>
                  )}
                  <div
                    className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <button
                        onClick={() => { setEditingVenue(v); setVenueDialogOpen(true); }}
                        className="flex items-center justify-center rounded-md bg-white/90 p-1 hover:bg-white"
                      >
                        <Pencil className="size-3 text-neutral-600" />
                      </button>
                    )}
                    {canDeleteVenue && (
                      <button
                        onClick={() => setDeleteTarget(v)}
                        className="flex items-center justify-center rounded-md bg-white/90 p-1 hover:bg-white"
                      >
                        <Trash2 className="size-3 text-red-500" />
                      </button>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${v.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                      {v.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Venue body */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">{v.name}</h3>
                  {v.address && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                      <MapPin className="size-3 shrink-0" /> {v.address}
                    </p>
                  )}
                  {v.description && <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400">{v.description}</p>}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <BookOpen className="size-3" />
                      {v._count.menus} menu{v._count.menus !== 1 ? "s" : ""}
                    </span>
                    <Button
                      size="sm"
                      render={<Link href={`/dashboard/properties/${id}/venues/${v.id}`} />}
                      className="h-7 gap-1 bg-neutral-900 px-2.5 text-xs text-white hover:bg-neutral-800"
                    >
                      Open <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={propImageInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePropImageChange} />
      <input ref={venueImageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleVenueImageChange} />

      <VenueDialog
        open={venueDialogOpen}
        onOpenChange={setVenueDialogOpen}
        initial={editingVenue ? { name: editingVenue.name, description: editingVenue.description ?? "", address: editingVenue.address ?? "" } : null}
        onSave={editingVenue ? updateVenue : createVenue}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete venue?"
        description={`"${deleteTarget?.name}" and all its menus and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteVenue}
        loading={deleting}
      />
    </div>
  );
}

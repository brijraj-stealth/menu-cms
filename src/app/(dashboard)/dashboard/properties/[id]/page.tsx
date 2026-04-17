"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, MapPin, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnProperty } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
}

interface Venue {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  isActive: boolean;
  propertyId: string;
  _count: { menus: number };
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
      {[...Array(3)].map((_, i) => (
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

// ─── Venue Form Dialog ────────────────────────────────────────────────────────

function VenueDialog({
  open,
  onOpenChange,
  initial,
  onSave,
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
    if (open) {
      setForm(initial ?? { name: "", description: "", address: "" });
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
          <DialogTitle>{initial ? "Edit Venue" : "Add Venue"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g. Main Restaurant"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Address</label>
            <Input
              placeholder="e.g. 123 Main St"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
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
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const fetchAll = useCallback(async () => {
    const [meRes, propRes, venueRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/properties/${id}`, { cache: "no-store" }),
      fetch(`/api/venues?propertyId=${id}`, { cache: "no-store" }),
    ]);
    const [meJson, propJson, venueJson] = await Promise.all([
      meRes.json(), propRes.json(), venueRes.json(),
    ]);
    if (meJson.data) setMe(meJson.data);
    if (propJson.data) {
      setProperty(propJson.data);
      setPropForm({ name: propJson.data.name, description: propJson.data.description ?? "" });
    }
    if (venueJson.data) setVenues(venueJson.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Property edit ──
  async function saveProperty(e: React.FormEvent) {
    e.preventDefault();
    setPropSaving(true);
    const res = await fetch(`/api/properties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(propForm),
    });
    const json = await res.json();
    if (json.data) {
      setProperty(json.data);
      setEditingProperty(false);
      toast.success("Property updated");
    } else {
      toast.error("Failed to update property");
    }
    setPropSaving(false);
  }

  // ── Venue create ──
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

  // ── Venue edit ──
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

  // ── Venue delete ──
  async function handleDeleteVenue() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/venues/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setVenues((prev) => prev.filter((v) => v.id !== deleteTarget.id));
        toast.success(`"${deleteTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete venue");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!property) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-destructive">Property not found.</p>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const canEditProp = me ? canOnProperty(me, "EDIT", id) : false;
  const canAddVenue = me ? (isAdmin(me.role) || canOnProperty(me, "ADD", id)) : false;
  const canDeleteVenue = me ? isAdmin(me.role) : false;

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href="/dashboard" />} className="-ml-2 mb-6">
        <ArrowLeft className="size-4" /> Dashboard
      </Button>

      {/* Property header */}
      <div className="mb-8 rounded-xl border p-5">
        {editingProperty ? (
          <form onSubmit={saveProperty} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={propForm.name}
                onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={propForm.description}
                onChange={(e) => setPropForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={propSaving}>
                {propSaving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingProperty(false);
                  setPropForm({ name: property.name, description: property.description ?? "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{property.name}</h1>
              {property.description && (
                <p className="mt-1 text-sm text-muted-foreground">{property.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{property.slug}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    property.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {property.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            {canEditProp && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingProperty(true)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Venues */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Venues
            <span className="ml-2 text-sm font-normal text-muted-foreground">({venues.length})</span>
          </h2>
          {canAddVenue && (
            <Button size="sm" onClick={() => { setEditingVenue(null); setVenueDialogOpen(true); }}>
              <Plus /> Add Venue
            </Button>
          )}
        </div>

        {venues.length === 0 ? (
          <div className="rounded-lg border border-dashed py-14 text-center">
            <MapPin className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No venues yet</p>
            {canAddVenue && (
              <Button size="sm" className="mt-4" onClick={() => { setEditingVenue(null); setVenueDialogOpen(true); }}>
                <Plus /> Add your first venue
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {venues.map((v) => {
              const canEdit = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{v.name}</p>
                    {v.address && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" /> {v.address}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{v._count.menus} menu{v._count.menus !== 1 ? "s" : ""}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          v.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pl-4">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setEditingVenue(v); setVenueDialogOpen(true); }}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                    {canDeleteVenue && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(v)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="xs"
                      render={<Link href={`/dashboard/properties/${id}/venues/${v.id}`} />}
                      className="ml-1"
                    >
                      Menus <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Venue dialog */}
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

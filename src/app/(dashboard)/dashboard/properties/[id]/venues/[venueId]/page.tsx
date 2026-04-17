"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Camera, Check, X, MoreHorizontal, Eye, Settings,
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
import { type MeData, isAdmin, canOnVenue, canOnProperty } from "@/lib/permissions";

interface VenueInfo {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  image: string | null;
  isActive: boolean;
  propertyId: string;
  sequenceNumber: number;
  property: { id: string; name: string; slug: string };
}

interface Menu {
  id: string;
  name: string;
  description: string | null;
  scheduleText: string | null;
  isActive: boolean;
  venueId: string;
  _count: { categories: number };
  itemsCount: number;
}

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-1 h-3.5 w-24 rounded bg-neutral-100" />
      <div className="mb-2 h-7 w-48 rounded bg-neutral-100" />
      <div className="mb-6 h-4 w-32 rounded bg-neutral-100" />
      <div className="h-48 rounded-xl bg-neutral-100" />
    </div>
  );
}

function EditVenueDialog({
  open, onOpenChange, venue, onSave, onUploadImage, onRemoveImage, uploading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venue: VenueInfo;
  onSave: (data: { name: string; description: string; address: string }) => Promise<void>;
  onUploadImage: () => void;
  onRemoveImage: () => void;
  uploading: boolean;
}) {
  const [form, setForm] = useState({ name: venue.name, description: venue.description ?? "", address: venue.address ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: venue.name, description: venue.description ?? "", address: venue.address ?? "" });
      setError(null);
    }
  }, [open, venue]);

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
        <DialogHeader><DialogTitle>Venue Settings</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Photo preview */}
          <div>
            <div
              onClick={!uploading ? onUploadImage : undefined}
              className={`group relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 transition-colors ${venue.image ? "border-neutral-200" : "border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-300"}`}
            >
              {venue.image ? (
                <>
                  <img src={venue.image} alt="Venue photo" className="h-full w-full object-cover" />
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
            {venue.image && !uploading && (
              <button type="button" onClick={onRemoveImage} className="mt-1.5 text-xs text-red-500 hover:text-red-700">Remove photo</button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Type / Description</label>
            <Input placeholder="e.g. Cocktail Bar, BBQ" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Address</label>
            <Input placeholder="Optional" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
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

function CreateMenuDialog({
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
        <DialogHeader><DialogTitle>Create New Menu</DialogTitle></DialogHeader>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteVenueOpen, setDeleteVenueOpen] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
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
    if (venueJson.data) setVenue(venueJson.data);
    if (menuJson.data) setMenus(menuJson.data);
    setLoading(false);
  }, [venueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function saveVenue(data: { name: string; description: string; address: string }) {
    const res = await fetch(`/api/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.data) { setVenue((prev) => prev ? { ...prev, ...json.data } : prev); toast.success("Venue updated"); }
    else throw new Error(json.error ?? "Failed to update");
  }

  async function handleDeleteVenue() {
    setDeletingVenue(true);
    try {
      const res = await fetch(`/api/venues/${venueId}`, { method: "DELETE" });
      if (res.ok) { toast.success(`"${venue?.name}" deleted`); router.push(`/dashboard/properties/${id}`); }
      else toast.error("Failed to delete venue");
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

  async function handleDeleteMenu() {
    if (!deleteMenuTarget) return;
    setDeletingMenu(true);
    try {
      const res = await fetch(`/api/menus/${deleteMenuTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setMenus((prev) => prev.filter((m) => m.id !== deleteMenuTarget.id));
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

  if (!venue) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Venue not found.</p>
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}`} />} className="mt-4">Back</Button>
      </div>
    );
  }

  const canEditVenue = me ? (isAdmin(me.role) || canOnProperty(me, "EDIT", id)) : false;
  const canManageVenue = me ? isAdmin(me.role) : false;
  const canAddMenu = me ? (isAdmin(me.role) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const isReadOnly = !canEditVenue;
  const roleLabel = me?.role === "SUPER_ADMIN" ? "Super Admin" : me?.role === "ADMIN" ? "Admin" : "Staff";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[12px] text-neutral-400">
            <Link href="/dashboard/properties" className="hover:text-neutral-600">All properties</Link>
            {" · "}
            <Link href={`/dashboard/properties/${id}`} className="hover:text-neutral-600">{venue.property.name}</Link>
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">Venue · v{venue.sequenceNumber}</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-neutral-900">{venue.name}</h1>
          {venue.description && <p className="mt-1 text-sm text-neutral-500">{venue.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEditVenue && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-8 gap-1.5 px-3 text-[13px]"
            >
              <Settings className="size-3.5" /> Settings
            </Button>
          )}
          {canManageVenue && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteVenueOpen(true)}
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

      {/* Menus table */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Menus</h2>
        {canAddMenu && (
          <Button onClick={() => setMenuDialogOpen(true)} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
            <Plus className="size-3.5" /> Create Menu
          </Button>
        )}
      </div>

      {menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-16">
          <h3 className="text-sm font-semibold text-neutral-900">No menus yet</h3>
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
        <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_160px_120px_80px_80px_40px] items-center border-b border-neutral-100 px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Menu</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Schedule</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Status</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Categories</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Items</p>
            <div />
          </div>

          {menus.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[1fr_160px_120px_80px_80px_40px] items-center border-b border-neutral-100 px-4 py-3 last:border-0 hover:bg-neutral-50/50 transition-colors"
            >
              <Link href={`/dashboard/properties/${id}/venues/${venueId}/menus/${m.id}`} className="flex items-center gap-2.5 min-w-0">
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate text-[13px] font-medium text-neutral-800 hover:underline">{m.name}</span>
              </Link>
              <p className="text-[13px] text-neutral-500">{m.scheduleText ?? "—"}</p>
              <div>
                {m.isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Published
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                    <span className="size-1.5 rounded-full bg-neutral-400" />
                    Draft
                  </span>
                )}
              </div>
              <p className="text-right text-[13px] text-neutral-700">{m._count.categories}</p>
              <p className="text-right text-[13px] text-neutral-700">{m.itemsCount}</p>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm" className="size-7 p-0 text-neutral-400 hover:text-neutral-700">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem render={<Link href={`/dashboard/properties/${id}/venues/${venueId}/menus/${m.id}`} />}>
                      <Pencil className="size-3.5" /> Edit Menu
                    </DropdownMenuItem>
                    {canManageVenue && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:bg-red-50 focus:text-red-700"
                          onClick={() => setDeleteMenuTarget(m)}
                        >
                          <Trash2 className="size-3.5" /> Delete Menu
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />

      <EditVenueDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        venue={venue}
        onSave={saveVenue}
        onUploadImage={() => imageInputRef.current?.click()}
        onRemoveImage={handleRemoveImage}
        uploading={uploadingImage}
      />

      <CreateMenuDialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen} onSave={createMenu} />

      <ConfirmDialog
        open={deleteVenueOpen}
        onOpenChange={(v) => { if (!v) setDeleteVenueOpen(false); }}
        title="Delete venue?"
        description={`"${venue.name}" and all its menus and items will be permanently deleted.`}
        onConfirm={handleDeleteVenue}
        loading={deletingVenue}
      />
      <ConfirmDialog
        open={!!deleteMenuTarget}
        onOpenChange={(v) => { if (!v) setDeleteMenuTarget(null); }}
        title="Delete menu?"
        description={`"${deleteMenuTarget?.name}" and all its categories and items will be permanently deleted.`}
        onConfirm={handleDeleteMenu}
        loading={deletingMenu}
      />
    </div>
  );
}

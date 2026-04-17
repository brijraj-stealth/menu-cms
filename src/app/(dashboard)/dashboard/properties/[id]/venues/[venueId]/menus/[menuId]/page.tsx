"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Copy, ImageIcon, LayoutGrid,
  LayoutList, Pencil, Phone, Plus, Trash2, Video, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnMenu, canOnVenue, canOnProperty } from "@/lib/permissions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Allergen { id: string; name: string; icon: string | null }
interface ItemVariant { id: string; name: string; price: string; isActive: boolean }
interface Item {
  id: string; name: string; description: string | null; basePrice: string;
  image: string | null; isActive: boolean; subCategoryId: string; sortOrder: number;
  variants: ItemVariant[];
  itemAllergens: { allergen: Allergen }[];
}
interface SubCategory {
  id: string; name: string; description: string | null; sortOrder: number;
  displayMode: string; isActive: boolean; categoryId: string; items: Item[];
}
interface Category {
  id: string; name: string; description: string | null; sortOrder: number;
  isActive: boolean; menuId: string; subCategories: SubCategory[];
}
interface MenuVideo { id: string; url: string; title: string | null; sortOrder: number }
interface MenuFeaturedImage { id: string; url: string; title: string | null; sortOrder: number }
interface MenuData {
  id: string; name: string; description: string | null;
  slug: string | null; phoneNumber: string | null; phoneButtonText: string | null;
  videoSectionHeader: string | null; videoSectionSubheader: string | null;
  featuredSectionHeader: string | null; featuredSectionSubheader: string | null;
  isActive: boolean; venueId: string;
  venue: { id: string; name: string; propertyId: string; property: { id: string; name: string; slug: string } };
  categories: Category[];
  videos: MenuVideo[];
  featuredImages: MenuFeaturedImage[];
}
interface ItemFormData {
  name: string; description: string; basePrice: number; isActive: boolean;
  image: string | null; allergenIds: string[];
  variants: { id?: string; name: string; price: number; isActive: boolean }[];
}

// ─── Array helpers ────────────────────────────────────────────────────────────

function moveUp<T extends { id: string }>(arr: T[], id: string): T[] {
  const i = arr.findIndex((x) => x.id === id);
  if (i <= 0) return arr;
  const n = [...arr];
  [n[i - 1], n[i]] = [n[i], n[i - 1]];
  return n;
}
function moveDown<T extends { id: string }>(arr: T[], id: string): T[] {
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0 || i >= arr.length - 1) return arr;
  const n = [...arr];
  [n[i], n[i + 1]] = [n[i + 1], n[i]];
  return n;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div>
      <div className="mb-6 h-8 w-32 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mb-8 rounded-2xl border border-neutral-200 p-6">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-neutral-100" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="mb-4 rounded-2xl border border-neutral-200">
          <div className="border-b bg-neutral-50 px-5 py-3.5">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-neutral-100" />
          </div>
          <div className="space-y-2 p-5">
            <div className="h-4 w-48 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-4 w-40 animate-pulse rounded-lg bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SimpleDialog ─────────────────────────────────────────────────────────────

function SimpleDialog({ open, onOpenChange, title, initial, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  initial: { name: string; description: string } | null;
  onSave: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setForm(initial ?? { name: "", description: "" }); setError(null); } }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try { await onSave(form); onOpenChange(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <Input placeholder="Optional" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ItemDialog ───────────────────────────────────────────────────────────────

type VariantDraft = { id?: string; name: string; price: string; isActive: boolean };

function ItemDialog({ open, onOpenChange, title, initial, allergens, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  initial: Item | null; allergens: Allergen[];
  onSave: (data: ItemFormData) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", isActive: true });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({ name: initial.name, description: initial.description ?? "", basePrice: initial.basePrice, isActive: initial.isActive });
        setVariants(initial.variants.map((v) => ({ id: v.id, name: v.name, price: String(v.price), isActive: v.isActive })));
        setSelectedAllergenIds(initial.itemAllergens.map((ia) => ia.allergen.id));
        setImageUrl(initial.image);
      } else {
        setForm({ name: "", description: "", basePrice: "", isActive: true });
        setVariants([]); setSelectedAllergenIds([]); setImageUrl(null);
      }
      setError(null);
    }
  }, [open, initial]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const toastId = toast.loading("Uploading image…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Upload failed", { id: toastId }); return; }
      setImageUrl(json.url);
      toast.success("Image uploaded", { id: toastId });
    } finally { setUploadingImage(false); e.target.value = ""; }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price < 0) { setError("Enter a valid base price"); return; }
    for (const v of variants) {
      if (!v.name.trim()) { setError("All variants must have a name"); return; }
      if (isNaN(parseFloat(v.price)) || parseFloat(v.price) < 0) { setError("All variants must have a valid price"); return; }
    }
    setSubmitting(true); setError(null);
    try {
      await onSave({
        name: form.name, description: form.description, basePrice: price, isActive: form.isActive,
        image: imageUrl, allergenIds: selectedAllergenIds,
        variants: variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name, price: parseFloat(v.price), isActive: v.isActive })),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Image</label>
            <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
            {imageUrl ? (
              <div className="group/img relative overflow-hidden rounded-xl">
                <img src={imageUrl} alt="item" className="h-36 w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover/img:bg-black/30">
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/img:opacity-100">
                    <ImageIcon className="size-3.5" /> Change
                  </button>
                  <button type="button" onClick={() => setImageUrl(null)} className="rounded-lg bg-white/90 p-1.5 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/img:opacity-100">
                    <X className="size-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
                className="flex h-28 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-600 disabled:opacity-50">
                <div className="flex flex-col items-center gap-1.5">
                  <ImageIcon className="size-6" />
                  <span className="text-xs">{uploadingImage ? "Uploading…" : "Click to upload image"}</span>
                </div>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Item name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus placeholder="e.g. Grilled Salmon" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Base price *</label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Active?</label>
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="size-4 rounded" />
                  {form.isActive ? "Yes" : "No"}
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <Input placeholder="Optional — shown to guests" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700">Variants</span>
              <button type="button" onClick={() => setVariants((p) => [...p, { name: "", price: "", isActive: true }])} className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
                <Plus className="size-3.5" /> Add variant
              </button>
            </div>
            {variants.length > 0 ? (
              <div className="flex flex-col gap-2">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="e.g. Small" value={v.name} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1" />
                    <Input type="number" step="0.01" min="0" placeholder="Price" value={v.price} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} className="w-24" />
                    <button type="button" onClick={() => setVariants((p) => p.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-500">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No variants — guests see the base price only.</p>
            )}
          </div>

          {allergens.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">Allergens</label>
              <div className="flex flex-wrap gap-2">
                {allergens.map((a) => {
                  const checked = selectedAllergenIds.includes(a.id);
                  return (
                    <label key={a.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${checked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedAllergenIds((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id])} className="sr-only" />
                      {a.icon && <span>{a.icon}</span>}{a.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
              {submitting ? "Saving…" : initial ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── DuplicateMenuDialog ──────────────────────────────────────────────────────

function DuplicateMenuDialog({ open, onOpenChange, menuId, menuName, onDuplicated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  menuId: string; menuName: string; onDuplicated: () => void;
}) {
  const [name, setName] = useState("");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(`Copy of ${menuName}`);
      setSelectedPropertyId(""); setSelectedVenueId(""); setVenues([]); setError(null);
      fetch("/api/properties", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setProperties(j.data); });
    }
  }, [open, menuName]);

  useEffect(() => {
    if (selectedPropertyId) {
      setSelectedVenueId(""); setVenues([]);
      fetch(`/api/venues?propertyId=${selectedPropertyId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setVenues(j.data); });
    }
  }, [selectedPropertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVenueId) { setError("Select a venue"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`/api/menus/${menuId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, venueId: selectedVenueId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to duplicate");
      toast.success(`"${name}" created`);
      onOpenChange(false);
      onDuplicated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Duplicate Menu</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">New name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Property *</label>
            <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm">
              <option value="">Select property…</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Venue *</label>
            <select value={selectedVenueId} onChange={(e) => setSelectedVenueId(e.target.value)} required disabled={!venues.length} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm disabled:opacity-50">
              <option value="">Select venue…</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-neutral-900 text-white hover:bg-neutral-700">
              {submitting ? "Duplicating…" : "Duplicate Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CopyItemsDialog ──────────────────────────────────────────────────────────

function CopyItemsDialog({ open, onOpenChange, currentMenu, onCopied }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  currentMenu: MenuData; onCopied: () => void;
}) {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [menus, setMenus] = useState<{ id: string; name: string }[]>([]);
  const [sourceMenuData, setSourceMenuData] = useState<MenuData | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [targetSubCategoryId, setTargetSubCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedPropertyId(""); setSelectedVenueId(""); setSelectedMenuId("");
      setSelectedSubCategoryId(""); setSelectedItemIds([]); setTargetSubCategoryId("");
      setSourceMenuData(null); setVenues([]); setMenus([]); setError(null);
      fetch("/api/properties", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setProperties(j.data); });
    }
  }, [open]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    setSelectedVenueId(""); setSelectedMenuId(""); setVenues([]); setMenus([]);
    fetch(`/api/venues?propertyId=${selectedPropertyId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setVenues(j.data); });
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!selectedVenueId) return;
    setSelectedMenuId(""); setMenus([]);
    fetch(`/api/menus?venueId=${selectedVenueId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setMenus(j.data); });
  }, [selectedVenueId]);

  useEffect(() => {
    if (!selectedMenuId) return;
    setSelectedSubCategoryId(""); setSelectedItemIds([]); setSourceMenuData(null);
    fetch(`/api/menus/${selectedMenuId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.data) setSourceMenuData(j.data); });
  }, [selectedMenuId]);

  const sourceItems = useMemo(() => {
    if (!sourceMenuData || !selectedSubCategoryId) return [];
    for (const cat of sourceMenuData.categories) {
      const sub = cat.subCategories.find((s) => s.id === selectedSubCategoryId);
      if (sub) return sub.items;
    }
    return [];
  }, [sourceMenuData, selectedSubCategoryId]);

  const targetSubCategories = useMemo(() => {
    const subs: { id: string; label: string }[] = [];
    for (const cat of currentMenu.categories) {
      for (const sub of cat.subCategories) {
        subs.push({ id: sub.id, label: `${cat.name} → ${sub.name}` });
      }
    }
    return subs;
  }, [currentMenu]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedItemIds.length === 0) { setError("Select at least one item"); return; }
    if (!targetSubCategoryId) { setError("Select a target section"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/items/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItemIds, targetSubCategoryId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to copy");
      toast.success(`${json.data.copied} item${json.data.copied !== 1 ? "s" : ""} copied`);
      onOpenChange(false);
      onCopied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy items");
    } finally { setSubmitting(false); }
  }

  const allSelected = sourceItems.length > 0 && selectedItemIds.length === sourceItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Copy Items</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Source</p>
            <div className="flex flex-col gap-3">
              <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm">
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={selectedVenueId} onChange={(e) => setSelectedVenueId(e.target.value)} disabled={!venues.length} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm disabled:opacity-50">
                <option value="">Select venue…</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select value={selectedMenuId} onChange={(e) => setSelectedMenuId(e.target.value)} disabled={!menus.length} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm disabled:opacity-50">
                <option value="">Select menu…</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {sourceMenuData && (
                <select value={selectedSubCategoryId} onChange={(e) => { setSelectedSubCategoryId(e.target.value); setSelectedItemIds([]); }} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm">
                  <option value="">Select section…</option>
                  {sourceMenuData.categories.map((cat) => cat.subCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{cat.name} → {sub.name}</option>
                  )))}
                </select>
              )}
              {sourceItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">{selectedItemIds.length} of {sourceItems.length} selected</span>
                    <button type="button" onClick={() => setSelectedItemIds(allSelected ? [] : sourceItems.map((i) => i.id))} className="text-xs text-neutral-500 hover:text-neutral-900">
                      {allSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-neutral-200">
                    {sourceItems.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-center gap-2.5 border-b border-neutral-100 px-3 py-2 last:border-0 hover:bg-neutral-50">
                        <input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => setSelectedItemIds((p) => p.includes(item.id) ? p.filter((x) => x !== item.id) : [...p, item.id])} className="size-4 rounded" />
                        {item.image && <img src={item.image} alt="" className="size-8 rounded object-cover" />}
                        <span className="flex-1 text-sm text-neutral-800">{item.name}</span>
                        <span className="text-xs text-neutral-400">${parseFloat(item.basePrice).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Destination</p>
            <select value={targetSubCategoryId} onChange={(e) => setTargetSubCategoryId(e.target.value)} className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm">
              <option value="">Select target section…</option>
              {targetSubCategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
            </select>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || selectedItemIds.length === 0} className="bg-neutral-900 text-white hover:bg-neutral-700">
              {submitting ? "Copying…" : `Copy ${selectedItemIds.length > 0 ? `${selectedItemIds.length} ` : ""}Item${selectedItemIds.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuBuilderPage() {
  const { id, venueId, menuId } = useParams<{ id: string; venueId: string; menuId: string }>();
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"structure" | "videos" | "featured">("structure");

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [subDialog, setSubDialog] = useState<{ open: boolean; editing: SubCategory | null; categoryId: string }>({ open: false, editing: null, categoryId: "" });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: Item | null; subCategoryId: string }>({ open: false, editing: null, subCategoryId: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "subcategory" | "item"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMenuOpen, setDeleteMenuOpen] = useState(false);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [copyItemsOpen, setCopyItemsOpen] = useState(false);

  const [editingMenuInfo, setEditingMenuInfo] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", description: "", slug: "", phoneNumber: "", phoneButtonText: "" });
  const [menuSaving, setMenuSaving] = useState(false);

  const [editingVideoSection, setEditingVideoSection] = useState(false);
  const [videoSectionForm, setVideoSectionForm] = useState({ header: "", subheader: "" });
  const [editingFeaturedSection, setEditingFeaturedSection] = useState(false);
  const [featuredSectionForm, setFeaturedSectionForm] = useState({ header: "", subheader: "" });

  const [videoForm, setVideoForm] = useState({ url: "", title: "" });
  const [addingVideo, setAddingVideo] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingVideoTitle, setEditingVideoTitle] = useState("");

  const [featuredImageTitle, setFeaturedImageTitle] = useState("");
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageTitle, setEditingImageTitle] = useState("");
  const featuredImageInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const [meRes, menuRes, allergenRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/menus/${menuId}`, { cache: "no-store" }),
      fetch("/api/allergens", { cache: "no-store" }),
    ]);
    const [meJson, menuJson, allergenJson] = await Promise.all([meRes.json(), menuRes.json(), allergenRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (menuJson.data) {
      const d = menuJson.data;
      setMenuData(d);
      setMenuForm({ name: d.name, description: d.description ?? "", slug: d.slug ?? "", phoneNumber: d.phoneNumber ?? "", phoneButtonText: d.phoneButtonText ?? "" });
      setVideoSectionForm({ header: d.videoSectionHeader ?? "", subheader: d.videoSectionSubheader ?? "" });
      setFeaturedSectionForm({ header: d.featuredSectionHeader ?? "", subheader: d.featuredSectionSubheader ?? "" });
      setExpandedCategories((prev) => { const next = new Set(prev); d.categories.forEach((c: Category) => next.add(c.id)); return next; });
    }
    if (allergenJson.data) setAllergens(allergenJson.data);
    setLoading(false);
  }, [menuId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Menu info ─────────────────────────────────────────────────────────────

  async function saveMenuInfo(e: React.FormEvent) {
    e.preventDefault();
    setMenuSaving(true);
    const res = await fetch(`/api/menus/${menuId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: menuForm.name, description: menuForm.description || null, slug: menuForm.slug || null, phoneNumber: menuForm.phoneNumber || null, phoneButtonText: menuForm.phoneButtonText || null }),
    });
    const json = await res.json();
    if (json.data) { setMenuData((p) => p ? { ...p, ...json.data } : p); setEditingMenuInfo(false); toast.success("Menu updated"); }
    else toast.error(json.error ?? "Failed to update menu");
    setMenuSaving(false);
  }

  // ─── Section headers ───────────────────────────────────────────────────────

  async function saveVideoHeaders() {
    const res = await fetch(`/api/menus/${menuId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoSectionHeader: videoSectionForm.header || null, videoSectionSubheader: videoSectionForm.subheader || null }) });
    const json = await res.json();
    if (json.data) { setMenuData((p) => p ? { ...p, videoSectionHeader: json.data.videoSectionHeader, videoSectionSubheader: json.data.videoSectionSubheader } : p); setEditingVideoSection(false); toast.success("Saved"); }
    else toast.error("Failed to save");
  }

  async function saveFeaturedHeaders() {
    const res = await fetch(`/api/menus/${menuId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featuredSectionHeader: featuredSectionForm.header || null, featuredSectionSubheader: featuredSectionForm.subheader || null }) });
    const json = await res.json();
    if (json.data) { setMenuData((p) => p ? { ...p, featuredSectionHeader: json.data.featuredSectionHeader, featuredSectionSubheader: json.data.featuredSectionSubheader } : p); setEditingFeaturedSection(false); toast.success("Saved"); }
    else toast.error("Failed to save");
  }

  // ─── Category CRUD ─────────────────────────────────────────────────────────

  async function createCategory(data: { name: string; description: string }) {
    const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, menuId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create category");
    await fetchData(); toast.success(`"${json.data.name}" created`);
  }
  async function updateCategory(data: { name: string; description: string }) {
    if (!categoryDialog.editing) return;
    const res = await fetch(`/api/categories/${categoryDialog.editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update category");
    await fetchData(); toast.success(`"${json.data.name}" updated`);
  }

  async function moveCat(catId: string, dir: "up" | "down") {
    if (!menuData) return;
    const newCats = dir === "up" ? moveUp(menuData.categories, catId) : moveDown(menuData.categories, catId);
    setMenuData({ ...menuData, categories: newCats });
    fetch("/api/categories/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orders: newCats.map((c, i) => ({ id: c.id, sortOrder: i })) }) })
      .catch(() => { toast.error("Failed to reorder"); fetchData(); });
  }

  // ─── SubCategory CRUD ──────────────────────────────────────────────────────

  async function createSubCategory(data: { name: string; description: string }) {
    const res = await fetch("/api/subcategories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, categoryId: subDialog.categoryId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create section");
    await fetchData(); toast.success(`"${json.data.name}" created`);
  }
  async function updateSubCategory(data: { name: string; description: string }) {
    if (!subDialog.editing) return;
    const res = await fetch(`/api/subcategories/${subDialog.editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update section");
    await fetchData(); toast.success(`"${json.data.name}" updated`);
  }

  async function moveSub(catId: string, subId: string, dir: "up" | "down") {
    if (!menuData) return;
    const newCats = menuData.categories.map((cat) => {
      if (cat.id !== catId) return cat;
      const newSubs = dir === "up" ? moveUp(cat.subCategories, subId) : moveDown(cat.subCategories, subId);
      return { ...cat, subCategories: newSubs };
    });
    setMenuData({ ...menuData, categories: newCats });
    const cat = newCats.find((c) => c.id === catId);
    if (!cat) return;
    fetch("/api/subcategories/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orders: cat.subCategories.map((s, i) => ({ id: s.id, sortOrder: i })) }) })
      .catch(() => { toast.error("Failed to reorder"); fetchData(); });
  }

  async function toggleDisplayMode(catId: string, subId: string, current: string) {
    const newMode = current === "LIST" ? "GRID" : "LIST";
    setMenuData((prev) => {
      if (!prev) return prev;
      return { ...prev, categories: prev.categories.map((cat) => cat.id !== catId ? cat : { ...cat, subCategories: cat.subCategories.map((sub) => sub.id !== subId ? sub : { ...sub, displayMode: newMode }) }) };
    });
    fetch(`/api/subcategories/${subId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayMode: newMode }) })
      .catch(() => { toast.error("Failed to update view mode"); fetchData(); });
  }

  // ─── Item CRUD ─────────────────────────────────────────────────────────────

  async function createItem(data: ItemFormData) {
    const res = await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, subCategoryId: itemDialog.subCategoryId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create item");
    await fetchData(); toast.success(`"${json.data.name}" added`);
  }
  async function updateItem(data: ItemFormData) {
    if (!itemDialog.editing) return;
    const res = await fetch(`/api/items/${itemDialog.editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update item");
    await fetchData(); toast.success(`"${json.data.name}" updated`);
  }

  async function moveItem(catId: string, subId: string, itemId: string, dir: "up" | "down") {
    if (!menuData) return;
    const newCats = menuData.categories.map((cat) => {
      if (cat.id !== catId) return cat;
      return { ...cat, subCategories: cat.subCategories.map((sub) => {
        if (sub.id !== subId) return sub;
        const newItems = dir === "up" ? moveUp(sub.items, itemId) : moveDown(sub.items, itemId);
        return { ...sub, items: newItems };
      }) };
    });
    setMenuData({ ...menuData, categories: newCats });
    const sub = newCats.find((c) => c.id === catId)?.subCategories.find((s) => s.id === subId);
    if (!sub) return;
    fetch("/api/items/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orders: sub.items.map((item, i) => ({ id: item.id, sortOrder: i })) }) })
      .catch(() => { toast.error("Failed to reorder"); fetchData(); });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.type === "category" ? `/api/categories/${deleteTarget.id}` : deleteTarget.type === "subcategory" ? `/api/subcategories/${deleteTarget.id}` : `/api/items/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) { await fetchData(); toast.success(`"${deleteTarget.name}" deleted`); }
      else toast.error(`Failed to delete ${deleteTarget.type}`);
    } finally { setDeleting(false); setDeleteTarget(null); }
  }

  async function handleDeleteMenu() {
    setDeletingMenu(true);
    try {
      const res = await fetch(`/api/menus/${menuId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${menuData?.name}" deleted`);
        router.push(`/dashboard/properties/${id}/venues/${venueId}`);
      } else {
        toast.error("Failed to delete menu");
      }
    } finally {
      setDeletingMenu(false);
      setDeleteMenuOpen(false);
    }
  }

  // ─── Video management ──────────────────────────────────────────────────────

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoForm.url.trim()) return;
    setAddingVideo(true);
    try {
      const res = await fetch(`/api/menus/${menuId}/videos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: videoForm.url.trim(), title: videoForm.title.trim() || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add video");
      setMenuData((p) => p ? { ...p, videos: [...p.videos, json.data] } : p);
      setVideoForm({ url: "", title: "" });
      toast.success("Video added");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setAddingVideo(false); }
  }

  async function deleteVideo(videoId: string) {
    const res = await fetch(`/api/menus/${menuId}/videos/${videoId}`, { method: "DELETE" });
    if (res.ok) { setMenuData((p) => p ? { ...p, videos: p.videos.filter((v) => v.id !== videoId) } : p); toast.success("Video removed"); }
    else toast.error("Failed to remove video");
  }

  async function moveVideo(videoId: string, dir: "up" | "down") {
    if (!menuData) return;
    const newVideos = dir === "up" ? moveUp(menuData.videos, videoId) : moveDown(menuData.videos, videoId);
    setMenuData({ ...menuData, videos: newVideos });
    Promise.all(newVideos.map((v, i) => fetch(`/api/menus/${menuId}/videos/${v.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })))
      .catch(() => { toast.error("Failed to reorder"); fetchData(); });
  }

  async function saveVideoTitle(videoId: string) {
    const res = await fetch(`/api/menus/${menuId}/videos/${videoId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingVideoTitle || null }) });
    if (res.ok) { setMenuData((p) => p ? { ...p, videos: p.videos.map((v) => v.id === videoId ? { ...v, title: editingVideoTitle || null } : v) } : p); setEditingVideoId(null); }
    else toast.error("Failed to save title");
  }

  // ─── Featured image management ─────────────────────────────────────────────

  async function handleFeaturedImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFeaturedImage(true);
    const toastId = toast.loading("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadJson.error ?? "Upload failed", { id: toastId }); return; }
      const addRes = await fetch(`/api/menus/${menuId}/featured-images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: uploadJson.url, title: featuredImageTitle.trim() || undefined }) });
      const addJson = await addRes.json();
      if (!addRes.ok) throw new Error(addJson.error ?? "Failed to add");
      setMenuData((p) => p ? { ...p, featuredImages: [...p.featuredImages, addJson.data] } : p);
      setFeaturedImageTitle("");
      toast.success("Image added", { id: toastId });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed", { id: toastId }); }
    finally { setUploadingFeaturedImage(false); e.target.value = ""; }
  }

  async function deleteFeaturedImage(imageId: string) {
    const res = await fetch(`/api/menus/${menuId}/featured-images/${imageId}`, { method: "DELETE" });
    if (res.ok) { setMenuData((p) => p ? { ...p, featuredImages: p.featuredImages.filter((img) => img.id !== imageId) } : p); toast.success("Image removed"); }
    else toast.error("Failed to remove image");
  }

  async function moveFeaturedImage(imageId: string, dir: "up" | "down") {
    if (!menuData) return;
    const newImages = dir === "up" ? moveUp(menuData.featuredImages, imageId) : moveDown(menuData.featuredImages, imageId);
    setMenuData({ ...menuData, featuredImages: newImages });
    Promise.all(newImages.map((img, i) => fetch(`/api/menus/${menuId}/featured-images/${img.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })))
      .catch(() => { toast.error("Failed to reorder"); fetchData(); });
  }

  async function saveFeaturedImageTitle(imageId: string) {
    const res = await fetch(`/api/menus/${menuId}/featured-images/${imageId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingImageTitle || null }) });
    if (res.ok) { setMenuData((p) => p ? { ...p, featuredImages: p.featuredImages.map((img) => img.id === imageId ? { ...img, title: editingImageTitle || null } : img) } : p); setEditingImageId(null); }
    else toast.error("Failed to save title");
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton />;

  if (!menuData) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Menu not found.</p>
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}/venues/${venueId}`} />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const admin = me ? isAdmin(me.role) : false;
  const canAdd = me ? (admin || canOnMenu(me, "ADD", menuId) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const canEdit = me ? (admin || canOnMenu(me, "EDIT", menuId) || canOnVenue(me, "EDIT", venueId) || canOnProperty(me, "EDIT", id)) : false;
  const canDelete = me ? admin : false;
  const totalItems = menuData.categories.reduce((sum, cat) => sum + cat.subCategories.reduce((s, sub) => s + sub.items.length, 0), 0);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}/venues/${venueId}`} />} className="-ml-2 mb-6 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> {menuData.venue.name}
      </Button>

      {/* Menu header card */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        {editingMenuInfo ? (
          <form onSubmit={saveMenuInfo} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Menu name *</label>
                <Input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Description</label>
                <Input placeholder="Optional" value={menuForm.description} onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Slug</label>
                <Input placeholder="e.g. dinner-menu" value={menuForm.slug} onChange={(e) => setMenuForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Phone number</label>
                <Input placeholder="e.g. +1 555 000 1234" value={menuForm.phoneNumber} onChange={(e) => setMenuForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Phone button text</label>
                <Input placeholder="e.g. Reserve a Table" value={menuForm.phoneButtonText} onChange={(e) => setMenuForm((f) => ({ ...f, phoneButtonText: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={menuSaving} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">{menuSaving ? "Saving…" : "Save Changes"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingMenuInfo(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-neutral-900">{menuData.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${menuData.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {menuData.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {menuData.description && <p className="mt-1.5 text-sm text-neutral-500">{menuData.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                <span>{menuData.venue.property.name} / {menuData.venue.name} · {menuData.categories.length} categories · {totalItems} items</span>
                {menuData.slug && <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600">/{menuData.slug}</span>}
                {menuData.phoneNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" />{menuData.phoneNumber}
                    {menuData.phoneButtonText && <span className="text-neutral-300">·</span>}
                    {menuData.phoneButtonText && <span className="italic">{menuData.phoneButtonText}</span>}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {admin && (
                <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)} className="h-8 gap-1.5 px-3 text-[13px]">
                  <Copy className="size-3.5" /> Duplicate
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditingMenuInfo(true)} className="h-8 gap-1.5 px-3 text-[13px]">
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
              {admin && (
                <Button variant="outline" size="sm" onClick={() => setDeleteMenuOpen(true)} className="h-8 gap-1.5 px-3 text-[13px] text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 border-b border-neutral-200">
        {(["structure", "videos", "featured"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}
          >
            {tab === "structure" && <LayoutList className="size-3.5" />}
            {tab === "videos" && <Video className="size-3.5" />}
            {tab === "featured" && <ImageIcon className="size-3.5" />}
            {tab === "structure" ? "Menu Structure" : tab === "videos" ? "Videos" : "Featured Posters"}
          </button>
        ))}
      </div>

      {/* ─── Tab: Structure ──────────────────────────────────────────────────── */}
      {activeTab === "structure" && (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">
              Menu Structure
              <span className="ml-2 text-sm font-normal text-neutral-400">({menuData.categories.length} categories)</span>
            </h2>
            <div className="flex gap-2">
              {admin && (
                <Button variant="outline" size="sm" onClick={() => setCopyItemsOpen(true)}>
                  <Copy className="size-3.5" /> Copy Items
                </Button>
              )}
              {canAdd && (
                <Button size="sm" onClick={() => setCategoryDialog({ open: true, editing: null })} className="h-9 gap-1.5 bg-neutral-900 px-4 text-white hover:bg-neutral-700">
                  <Plus className="size-4" /> Add Category
                </Button>
              )}
            </div>
          </div>

          {menuData.categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-20">
              <p className="text-sm font-medium text-neutral-500">No categories yet</p>
              <p className="mt-1 text-xs text-neutral-400">Categories group your menu sections (e.g. Starters, Mains, Desserts)</p>
              {canAdd && (
                <Button size="sm" className="mt-5 bg-neutral-900 text-white hover:bg-neutral-700" onClick={() => setCategoryDialog({ open: true, editing: null })}>
                  <Plus className="size-4" /> Add first category
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {menuData.categories.map((cat, catIdx) => {
                const isExpanded = expandedCategories.has(cat.id);
                const totalCatItems = cat.subCategories.reduce((s, sub) => s + sub.items.length, 0);
                return (
                  <div key={cat.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between bg-neutral-50 px-5 py-3.5">
                      <button onClick={() => setExpandedCategories((p) => { const n = new Set(p); if (n.has(cat.id)) n.delete(cat.id); else n.add(cat.id); return n; })} className="flex flex-1 items-center gap-2.5 text-left">
                        {isExpanded ? <ChevronDown className="size-4 text-neutral-400" /> : <ChevronRight className="size-4 text-neutral-400" />}
                        <span className="font-semibold text-neutral-900">{cat.name}</span>
                        {!cat.isActive && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-500">Inactive</span>}
                        <span className="text-xs text-neutral-400">{cat.subCategories.length} section{cat.subCategories.length !== 1 ? "s" : ""} · {totalCatItems} item{totalCatItems !== 1 ? "s" : ""}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => moveCat(cat.id, "up")} disabled={catIdx === 0} className="text-neutral-400 disabled:opacity-30">
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => moveCat(cat.id, "down")} disabled={catIdx === menuData.categories.length - 1} className="text-neutral-400 disabled:opacity-30">
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setCategoryDialog({ open: true, editing: cat })}>
                              <Pencil className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })} className="text-destructive hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5">
                        {cat.subCategories.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-neutral-200 py-8 text-center">
                            <p className="text-xs text-neutral-400">No sections yet</p>
                            {canAdd && (
                              <button onClick={() => setSubDialog({ open: true, editing: null, categoryId: cat.id })} className="mx-auto mt-2 flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
                                <Plus className="size-3.5" /> Add section
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {cat.subCategories.map((sub, subIdx) => (
                              <div key={sub.id} className="rounded-xl border border-neutral-100 bg-neutral-50">
                                <div className="flex items-center justify-between px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-neutral-800">{sub.name}</span>
                                    {!sub.isActive && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">Inactive</span>}
                                    <span className="text-xs text-neutral-400">{sub.items.length} item{sub.items.length !== 1 ? "s" : ""}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {canEdit && (
                                      <>
                                        <button
                                          onClick={() => toggleDisplayMode(cat.id, sub.id, sub.displayMode)}
                                          title={sub.displayMode === "LIST" ? "Switch to grid view" : "Switch to list view"}
                                          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                                        >
                                          {sub.displayMode === "GRID" ? <LayoutGrid className="size-3.5" /> : <LayoutList className="size-3.5" />}
                                          <span className="hidden sm:inline">{sub.displayMode}</span>
                                        </button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => moveSub(cat.id, sub.id, "up")} disabled={subIdx === 0} className="text-neutral-400 disabled:opacity-30">
                                          <ChevronUp className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => moveSub(cat.id, sub.id, "down")} disabled={subIdx === cat.subCategories.length - 1} className="text-neutral-400 disabled:opacity-30">
                                          <ChevronDown className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => setSubDialog({ open: true, editing: sub, categoryId: cat.id })}>
                                          <Pencil className="size-3.5" />
                                        </Button>
                                      </>
                                    )}
                                    {canDelete && (
                                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "subcategory", id: sub.id, name: sub.name })} className="text-destructive hover:text-destructive">
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="px-4 pb-3">
                                  {sub.items.length > 0 && (
                                    <div className="mb-2 flex flex-col gap-1.5">
                                      {sub.items.map((item, itemIdx) => (
                                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
                                          {item.image && <img src={item.image} alt={item.name} className="mr-3 size-10 shrink-0 rounded-lg object-cover" />}
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium text-neutral-900">{item.name}</span>
                                              {!item.isActive && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-400">Inactive</span>}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-neutral-400">
                                              <span className="font-semibold text-neutral-600">${parseFloat(item.basePrice).toFixed(2)}</span>
                                              {item.variants.length > 0 && <span>{item.variants.length} variant{item.variants.length !== 1 ? "s" : ""}</span>}
                                              {item.itemAllergens.length > 0 && (
                                                <span className="flex flex-wrap gap-1">
                                                  {item.itemAllergens.map((ia) => (
                                                    <span key={ia.allergen.id} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                      {ia.allergen.icon ? `${ia.allergen.icon} ` : ""}{ia.allergen.name}
                                                    </span>
                                                  ))}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-1 pl-3">
                                            {canEdit && (
                                              <>
                                                <Button variant="ghost" size="icon-sm" onClick={() => moveItem(cat.id, sub.id, item.id, "up")} disabled={itemIdx === 0} className="text-neutral-400 disabled:opacity-30">
                                                  <ChevronUp className="size-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" onClick={() => moveItem(cat.id, sub.id, item.id, "down")} disabled={itemIdx === sub.items.length - 1} className="text-neutral-400 disabled:opacity-30">
                                                  <ChevronDown className="size-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" onClick={() => setItemDialog({ open: true, editing: item, subCategoryId: sub.id })}>
                                                  <Pencil className="size-3.5" />
                                                </Button>
                                              </>
                                            )}
                                            {canDelete && (
                                              <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "item", id: item.id, name: item.name })} className="text-destructive hover:text-destructive">
                                                <Trash2 className="size-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {canAdd && (
                                    <button onClick={() => setItemDialog({ open: true, editing: null, subCategoryId: sub.id })} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900">
                                      <Plus className="size-3.5" /> Add item to this section
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {canAdd && (
                              <button onClick={() => setSubDialog({ open: true, editing: null, categoryId: cat.id })} className="flex items-center gap-1.5 rounded-xl border border-dashed border-neutral-200 px-4 py-2.5 text-xs font-medium text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-900">
                                <Plus className="size-3.5" /> Add new section to {cat.name}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Videos ─────────────────────────────────────────────────────── */}
      {activeTab === "videos" && (
        <div className="flex flex-col gap-6">
          {/* Section header */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Section Heading</h3>
              {canEdit && !editingVideoSection && (
                <Button variant="outline" size="sm" onClick={() => { setVideoSectionForm({ header: menuData.videoSectionHeader ?? "", subheader: menuData.videoSectionSubheader ?? "" }); setEditingVideoSection(true); }}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
            </div>
            {editingVideoSection ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Header</label>
                  <Input placeholder="e.g. Watch Us in Action" value={videoSectionForm.header} onChange={(e) => setVideoSectionForm((f) => ({ ...f, header: e.target.value }))} autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Subheader</label>
                  <Input placeholder="Optional subtitle" value={videoSectionForm.subheader} onChange={(e) => setVideoSectionForm((f) => ({ ...f, subheader: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveVideoHeaders} className="bg-neutral-900 text-white hover:bg-neutral-700">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingVideoSection(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div>
                {menuData.videoSectionHeader ? (
                  <>
                    <p className="text-lg font-semibold text-neutral-900">{menuData.videoSectionHeader}</p>
                    {menuData.videoSectionSubheader && <p className="mt-1 text-sm text-neutral-500">{menuData.videoSectionSubheader}</p>}
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">No heading set — click Edit to add one.</p>
                )}
              </div>
            )}
          </div>

          {/* Video list */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-neutral-900">Videos <span className="text-sm font-normal text-neutral-400">({menuData.videos.length})</span></h3>
            {menuData.videos.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {menuData.videos.map((video, vidIdx) => (
                  <div key={video.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
                    <Video className="size-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      {editingVideoId === video.id ? (
                        <div className="flex items-center gap-2">
                          <Input value={editingVideoTitle} onChange={(e) => setEditingVideoTitle(e.target.value)} placeholder="Video title" className="h-7 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveVideoTitle(video.id); if (e.key === "Escape") setEditingVideoId(null); }} />
                          <Button size="sm" onClick={() => saveVideoTitle(video.id)} className="h-7 bg-neutral-900 text-white hover:bg-neutral-700">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingVideoId(null)} className="h-7">Cancel</Button>
                        </div>
                      ) : (
                        <div>
                          {video.title && <p className="text-sm font-medium text-neutral-900">{video.title}</p>}
                          <p className="truncate text-xs text-neutral-400">{video.url}</p>
                        </div>
                      )}
                    </div>
                    {canEdit && editingVideoId !== video.id && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditingVideoId(video.id); setEditingVideoTitle(video.title ?? ""); }} className="text-neutral-400">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => moveVideo(video.id, "up")} disabled={vidIdx === 0} className="text-neutral-400 disabled:opacity-30">
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => moveVideo(video.id, "down")} disabled={vidIdx === menuData.videos.length - 1} className="text-neutral-400 disabled:opacity-30">
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteVideo(video.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <form onSubmit={addVideo} className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-200 p-4">
                <p className="text-xs font-semibold text-neutral-500">Add video</p>
                <Input placeholder="Video URL (YouTube, Vimeo, MP4…)" value={videoForm.url} onChange={(e) => setVideoForm((f) => ({ ...f, url: e.target.value }))} required />
                <Input placeholder="Title (optional)" value={videoForm.title} onChange={(e) => setVideoForm((f) => ({ ...f, title: e.target.value }))} />
                <Button type="submit" size="sm" disabled={addingVideo || !videoForm.url.trim()} className="w-fit bg-neutral-900 text-white hover:bg-neutral-700">
                  <Plus className="size-3.5" /> {addingVideo ? "Adding…" : "Add Video"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Featured Posters ───────────────────────────────────────────── */}
      {activeTab === "featured" && (
        <div className="flex flex-col gap-6">
          {/* Section header */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Section Heading</h3>
              {canEdit && !editingFeaturedSection && (
                <Button variant="outline" size="sm" onClick={() => { setFeaturedSectionForm({ header: menuData.featuredSectionHeader ?? "", subheader: menuData.featuredSectionSubheader ?? "" }); setEditingFeaturedSection(true); }}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
            </div>
            {editingFeaturedSection ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Header</label>
                  <Input placeholder="e.g. Chef's Specials" value={featuredSectionForm.header} onChange={(e) => setFeaturedSectionForm((f) => ({ ...f, header: e.target.value }))} autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Subheader</label>
                  <Input placeholder="Optional subtitle" value={featuredSectionForm.subheader} onChange={(e) => setFeaturedSectionForm((f) => ({ ...f, subheader: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveFeaturedHeaders} className="bg-neutral-900 text-white hover:bg-neutral-700">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingFeaturedSection(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div>
                {menuData.featuredSectionHeader ? (
                  <>
                    <p className="text-lg font-semibold text-neutral-900">{menuData.featuredSectionHeader}</p>
                    {menuData.featuredSectionSubheader && <p className="mt-1 text-sm text-neutral-500">{menuData.featuredSectionSubheader}</p>}
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">No heading set — click Edit to add one.</p>
                )}
              </div>
            )}
          </div>

          {/* Featured images */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-neutral-900">Posters <span className="text-sm font-normal text-neutral-400">({menuData.featuredImages.length})</span></h3>

            {menuData.featuredImages.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {menuData.featuredImages.map((img, imgIdx) => (
                  <div key={img.id} className="group relative overflow-hidden rounded-xl border border-neutral-200">
                    <img src={img.url} alt={img.title ?? ""} className="aspect-3/4 w-full object-cover" />
                    <div className="absolute inset-0 flex flex-col justify-between bg-black/0 transition-colors group-hover:bg-black/40">
                      <div className="flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => moveFeaturedImage(img.id, "up")} disabled={imgIdx === 0} className="rounded-md bg-white/90 p-1 text-neutral-700 shadow-sm disabled:opacity-30 hover:bg-white">
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button onClick={() => moveFeaturedImage(img.id, "down")} disabled={imgIdx === menuData.featuredImages.length - 1} className="rounded-md bg-white/90 p-1 text-neutral-700 shadow-sm disabled:opacity-30 hover:bg-white">
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button onClick={() => deleteFeaturedImage(img.id)} className="rounded-md bg-white/90 p-1 text-red-500 shadow-sm hover:bg-white">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="p-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {editingImageId === img.id ? (
                          <div className="flex gap-1">
                            <input
                              value={editingImageTitle}
                              onChange={(e) => setEditingImageTitle(e.target.value)}
                              placeholder="Title…"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") saveFeaturedImageTitle(img.id); if (e.key === "Escape") setEditingImageId(null); }}
                              className="h-7 flex-1 rounded-md border-0 bg-white/90 px-2 text-xs text-neutral-900 shadow-sm focus:outline-none"
                            />
                            <button onClick={() => saveFeaturedImageTitle(img.id)} className="rounded-md bg-neutral-900 px-2 text-xs text-white">✓</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingImageId(img.id); setEditingImageTitle(img.title ?? ""); }} className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-neutral-700 shadow-sm hover:bg-white">
                            <Pencil className="size-3" />{img.title || "Add title"}
                          </button>
                        )}
                      </div>
                    </div>
                    {img.title && editingImageId !== img.id && (
                      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 transition-opacity group-hover:opacity-0">
                        <p className="truncate text-xs font-medium text-white">{img.title}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-200 p-4">
                <p className="text-xs font-semibold text-neutral-500">Add poster</p>
                <Input placeholder="Image title (optional)" value={featuredImageTitle} onChange={(e) => setFeaturedImageTitle(e.target.value)} />
                <input ref={featuredImageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFeaturedImageUpload} />
                <Button type="button" size="sm" onClick={() => featuredImageInputRef.current?.click()} disabled={uploadingFeaturedImage} className="w-fit bg-neutral-900 text-white hover:bg-neutral-700">
                  <ImageIcon className="size-3.5" /> {uploadingFeaturedImage ? "Uploading…" : "Upload Image"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────────────────── */}
      <SimpleDialog
        open={categoryDialog.open}
        onOpenChange={(v) => setCategoryDialog((s) => ({ ...s, open: v }))}
        title={categoryDialog.editing ? "Edit Category" : "Add Category"}
        initial={categoryDialog.editing ? { name: categoryDialog.editing.name, description: categoryDialog.editing.description ?? "" } : null}
        onSave={categoryDialog.editing ? updateCategory : createCategory}
      />
      <SimpleDialog
        open={subDialog.open}
        onOpenChange={(v) => setSubDialog((s) => ({ ...s, open: v }))}
        title={subDialog.editing ? "Edit Section" : "Add Section"}
        initial={subDialog.editing ? { name: subDialog.editing.name, description: subDialog.editing.description ?? "" } : null}
        onSave={subDialog.editing ? updateSubCategory : createSubCategory}
      />
      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(v) => setItemDialog((s) => ({ ...s, open: v }))}
        title={itemDialog.editing ? "Edit Item" : "Add Item"}
        initial={itemDialog.editing}
        allergens={allergens}
        onSave={itemDialog.editing ? updateItem : createItem}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget?.type}?`}
        description={`"${deleteTarget?.name}" will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
      <ConfirmDialog
        open={deleteMenuOpen}
        onOpenChange={(v) => { if (!v) setDeleteMenuOpen(false); }}
        title="Delete menu?"
        description={`"${menuData?.name}" and all its categories and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDeleteMenu}
        loading={deletingMenu}
      />
      <DuplicateMenuDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        menuId={menuId}
        menuName={menuData.name}
        onDuplicated={fetchData}
      />
      {menuData && (
        <CopyItemsDialog
          open={copyItemsOpen}
          onOpenChange={setCopyItemsOpen}
          currentMenu={menuData}
          onCopied={fetchData}
        />
      )}
    </div>
  );
}

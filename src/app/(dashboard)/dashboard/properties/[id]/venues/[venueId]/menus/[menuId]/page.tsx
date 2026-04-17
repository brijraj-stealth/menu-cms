"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ImageIcon, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnMenu, canOnVenue, canOnProperty } from "@/lib/permissions";

interface Allergen { id: string; name: string; icon: string | null; }
interface ItemVariant { id: string; name: string; price: string; isActive: boolean; }
interface Item {
  id: string; name: string; description: string | null; basePrice: string;
  image: string | null; isActive: boolean; subCategoryId: string;
  variants: ItemVariant[];
  itemAllergens: { allergen: Allergen }[];
}
interface SubCategory {
  id: string; name: string; description: string | null; sortOrder: number;
  isActive: boolean; categoryId: string; items: Item[];
}
interface Category {
  id: string; name: string; description: string | null; sortOrder: number;
  isActive: boolean; menuId: string; subCategories: SubCategory[];
}
interface MenuData {
  id: string; name: string; description: string | null; isActive: boolean; venueId: string;
  venue: { id: string; name: string; propertyId: string; property: { id: string; name: string; slug: string } };
  categories: Category[];
}
interface ItemFormData {
  name: string; description: string; basePrice: number; isActive: boolean;
  image: string | null;
  allergenIds: string[];
  variants: { id?: string; name: string; price: number; isActive: boolean }[];
}

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
    setSubmitting(true);
    setError(null);
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
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Upload failed", { id: toastId }); return; }
      setImageUrl(json.url);
      toast.success("Image uploaded", { id: toastId });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price < 0) { setError("Enter a valid base price"); return; }
    for (const v of variants) {
      if (!v.name.trim()) { setError("All variants must have a name"); return; }
      if (isNaN(parseFloat(v.price)) || parseFloat(v.price) < 0) { setError("All variants must have a valid price"); return; }
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: form.name, description: form.description, basePrice: price, isActive: form.isActive,
        image: imageUrl,
        allergenIds: selectedAllergenIds,
        variants: variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name, price: parseFloat(v.price), isActive: v.isActive })),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Image upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Image</label>
            <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
            {imageUrl ? (
              <div className="group/img relative overflow-hidden rounded-xl">
                <img src={imageUrl} alt="item" className="h-36 w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover/img:bg-black/30">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/img:opacity-100"
                  >
                    <ImageIcon className="size-3.5" /> Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="rounded-lg bg-white/90 p-1.5 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/img:opacity-100"
                  >
                    <X className="size-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex h-28 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-600 disabled:opacity-50"
              >
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

          {/* Variants */}
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

          {/* Allergens */}
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

export default function MenuBuilderPage() {
  const { id, venueId, menuId } = useParams<{ id: string; venueId: string; menuId: string }>();
  const [me, setMe] = useState<MeData | null>(null);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [subDialog, setSubDialog] = useState<{ open: boolean; editing: SubCategory | null; categoryId: string }>({ open: false, editing: null, categoryId: "" });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: Item | null; subCategoryId: string }>({ open: false, editing: null, subCategoryId: "" });
  const [editingMenuInfo, setEditingMenuInfo] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", description: "" });
  const [menuSaving, setMenuSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "subcategory" | "item"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    const [meRes, menuRes, allergenRes] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch(`/api/menus/${menuId}`, { cache: "no-store" }),
      fetch("/api/allergens", { cache: "no-store" }),
    ]);
    const [meJson, menuJson, allergenJson] = await Promise.all([meRes.json(), menuRes.json(), allergenRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (menuJson.data) {
      setMenuData(menuJson.data);
      setMenuForm({ name: menuJson.data.name, description: menuJson.data.description ?? "" });
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        menuJson.data.categories.forEach((c: Category) => next.add(c.id));
        return next;
      });
    }
    if (allergenJson.data) setAllergens(allergenJson.data);
    setLoading(false);
  }, [menuId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveMenuInfo(e: React.FormEvent) {
    e.preventDefault();
    setMenuSaving(true);
    const res = await fetch(`/api/menus/${menuId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(menuForm) });
    const json = await res.json();
    if (json.data) { setMenuData((p) => p ? { ...p, name: json.data.name, description: json.data.description } : p); setEditingMenuInfo(false); toast.success("Menu updated"); }
    else toast.error("Failed to update menu");
    setMenuSaving(false);
  }

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
  async function createSubCategory(data: { name: string; description: string }) {
    const res = await fetch("/api/subcategories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, categoryId: subDialog.categoryId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create sub-category");
    await fetchData(); toast.success(`"${json.data.name}" created`);
  }
  async function updateSubCategory(data: { name: string; description: string }) {
    if (!subDialog.editing) return;
    const res = await fetch(`/api/subcategories/${subDialog.editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update sub-category");
    await fetchData(); toast.success(`"${json.data.name}" updated`);
  }
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

  const canAdd = me ? (isAdmin(me.role) || canOnMenu(me, "ADD", menuId) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const canEdit = me ? (isAdmin(me.role) || canOnMenu(me, "EDIT", menuId) || canOnVenue(me, "EDIT", venueId) || canOnProperty(me, "EDIT", id)) : false;
  const canDelete = me ? isAdmin(me.role) : false;

  const totalItems = menuData.categories.reduce((sum, cat) => sum + cat.subCategories.reduce((s, sub) => s + sub.items.length, 0), 0);

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}/venues/${venueId}`} />} className="-ml-2 mb-6 text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" /> {menuData.venue.name}
      </Button>

      {/* Menu header */}
      <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6">
        {editingMenuInfo ? (
          <form onSubmit={saveMenuInfo} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Menu name</label>
              <Input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Description</label>
              <Input placeholder="Optional" value={menuForm.description} onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={menuSaving} className="bg-neutral-900 text-white hover:bg-neutral-700">{menuSaving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingMenuInfo(false); setMenuForm({ name: menuData.name, description: menuData.description ?? "" }); }}>Cancel</Button>
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
              <p className="mt-2 text-xs text-neutral-400">
                {menuData.venue.property.name} / {menuData.venue.name} · {menuData.categories.length} categories · {totalItems} items
              </p>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditingMenuInfo(true)} className="shrink-0">
                <Pencil className="size-3.5" /> Edit Details
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Categories header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-900">
          Menu Structure
          <span className="ml-2 text-sm font-normal text-neutral-400">({menuData.categories.length} categories)</span>
        </h2>
        {canAdd && (
          <Button size="sm" onClick={() => setCategoryDialog({ open: true, editing: null })} className="h-9 gap-1.5 bg-neutral-900 px-4 text-white hover:bg-neutral-700">
            <Plus className="size-4" /> Add Category
          </Button>
        )}
      </div>

      {/* Empty state */}
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
          {menuData.categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.id);
            const totalCatItems = cat.subCategories.reduce((s, sub) => s + sub.items.length, 0);
            return (
              <div key={cat.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {/* Category header */}
                <div className="flex items-center justify-between bg-neutral-50 px-5 py-3.5">
                  <button onClick={() => setExpandedCategories((p) => { const n = new Set(p); if (n.has(cat.id)) n.delete(cat.id); else n.add(cat.id); return n; })} className="flex flex-1 items-center gap-2.5 text-left">
                    {isExpanded ? <ChevronDown className="size-4 text-neutral-400" /> : <ChevronRight className="size-4 text-neutral-400" />}
                    <span className="font-semibold text-neutral-900">{cat.name}</span>
                    {!cat.isActive && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-500">Inactive</span>}
                    <span className="text-xs text-neutral-400">{cat.subCategories.length} section{cat.subCategories.length !== 1 ? "s" : ""} · {totalCatItems} item{totalCatItems !== 1 ? "s" : ""}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setCategoryDialog({ open: true, editing: cat })}>
                        <Pencil className="size-3.5" /><span className="sr-only">Edit</span>
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })} className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" /><span className="sr-only">Delete</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded */}
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
                        {cat.subCategories.map((sub) => (
                          <div key={sub.id} className="rounded-xl border border-neutral-100 bg-neutral-50">
                            {/* Sub-category header */}
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-neutral-800">{sub.name}</span>
                                {!sub.isActive && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">Inactive</span>}
                                <span className="text-xs text-neutral-400">{sub.items.length} item{sub.items.length !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setSubDialog({ open: true, editing: sub, categoryId: cat.id })}>
                                    <Pencil className="size-3.5" /><span className="sr-only">Edit</span>
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "subcategory", id: sub.id, name: sub.name })} className="text-destructive hover:text-destructive">
                                    <Trash2 className="size-3.5" /><span className="sr-only">Delete</span>
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Items */}
                            <div className="px-4 pb-3">
                              {sub.items.length > 0 && (
                                <div className="mb-2 flex flex-col gap-1.5">
                                  {sub.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
                                      {item.image && (
                                        <img src={item.image} alt={item.name} className="mr-3 size-10 shrink-0 rounded-lg object-cover" />
                                      )}
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
                                          <Button variant="ghost" size="icon-sm" onClick={() => setItemDialog({ open: true, editing: item, subCategoryId: sub.id })}>
                                            <Pencil className="size-3.5" /><span className="sr-only">Edit</span>
                                          </Button>
                                        )}
                                        {canDelete && (
                                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget({ type: "item", id: item.id, name: item.name })} className="text-destructive hover:text-destructive">
                                            <Trash2 className="size-3.5" /><span className="sr-only">Delete</span>
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
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Tag, Layers, Package2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnMenu, canOnVenue, canOnProperty } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  venue: {
    id: string; name: string; propertyId: string;
    property: { id: string; name: string; slug: string };
  };
  categories: Category[];
}

interface ItemFormData {
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  allergenIds: string[];
  variants: { id?: string; name: string; price: number; isActive: boolean }[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-8 rounded-xl border p-5">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="mb-4 rounded-xl border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2 p-4">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Simple Name/Description Dialog ──────────────────────────────────────────

function SimpleDialog({
  open, onOpenChange, title, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Optional"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Dialog ──────────────────────────────────────────────────────────────

type VariantDraft = { id?: string; name: string; price: string; isActive: boolean };

function ItemDialog({
  open, onOpenChange, title, initial, allergens, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial: Item | null;
  allergens: Allergen[];
  onSave: (data: ItemFormData) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", isActive: true });
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name,
          description: initial.description ?? "",
          basePrice: initial.basePrice,
          isActive: initial.isActive,
        });
        setVariants(
          initial.variants.map((v) => ({ id: v.id, name: v.name, price: String(v.price), isActive: v.isActive }))
        );
        setSelectedAllergenIds(initial.itemAllergens.map((ia) => ia.allergen.id));
      } else {
        setForm({ name: "", description: "", basePrice: "", isActive: true });
        setVariants([]);
        setSelectedAllergenIds([]);
      }
      setError(null);
    }
  }, [open, initial]);

  function addVariant() {
    setVariants((prev) => [...prev, { name: "", price: "", isActive: true }]);
  }
  function removeVariant(i: number) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateVariant(i: number, field: keyof VariantDraft, value: string | boolean) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }
  function toggleAllergen(allergenId: string) {
    setSelectedAllergenIds((prev) =>
      prev.includes(allergenId) ? prev.filter((id) => id !== allergenId) : [...prev, allergenId]
    );
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
        name: form.name,
        description: form.description,
        basePrice: price,
        isActive: form.isActive,
        allergenIds: selectedAllergenIds,
        variants: variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name,
          price: parseFloat(v.price),
          isActive: v.isActive,
        })),
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
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm font-medium">Base Price *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Active</label>
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="size-4 rounded"
                  />
                  {form.isActive ? "Yes" : "No"}
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Optional"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Variants</label>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3" /> Add variant
              </button>
            </div>
            {variants.length > 0 ? (
              <div className="flex flex-col gap-2">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Name (e.g. Small)"
                      value={v.name}
                      onChange={(e) => updateVariant(i, "name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => updateVariant(i, "price", e.target.value)}
                      className="w-24"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No variants — base price only.</p>
            )}
          </div>

          {/* Allergens */}
          {allergens.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">Allergens</label>
              <div className="flex flex-wrap gap-2">
                {allergens.map((a) => {
                  const checked = selectedAllergenIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                        checked ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAllergen(a.id)}
                        className="sr-only"
                      />
                      {a.icon && <span>{a.icon}</span>}
                      {a.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    const [meJson, menuJson, allergenJson] = await Promise.all([
      meRes.json(), menuRes.json(), allergenRes.json(),
    ]);
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

  function toggleCategory(catId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  async function saveMenuInfo(e: React.FormEvent) {
    e.preventDefault();
    setMenuSaving(true);
    const res = await fetch(`/api/menus/${menuId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menuForm),
    });
    const json = await res.json();
    if (json.data) {
      setMenuData((prev) => prev ? { ...prev, name: json.data.name, description: json.data.description } : prev);
      setEditingMenuInfo(false);
      toast.success("Menu updated");
    } else {
      toast.error("Failed to update menu");
    }
    setMenuSaving(false);
  }

  async function createCategory(data: { name: string; description: string }) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, menuId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create category");
    await fetchData();
    toast.success(`"${json.data.name}" created`);
  }

  async function updateCategory(data: { name: string; description: string }) {
    if (!categoryDialog.editing) return;
    const res = await fetch(`/api/categories/${categoryDialog.editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update category");
    await fetchData();
    toast.success(`"${json.data.name}" updated`);
  }

  async function createSubCategory(data: { name: string; description: string }) {
    const res = await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, categoryId: subDialog.categoryId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create sub-category");
    await fetchData();
    toast.success(`"${json.data.name}" created`);
  }

  async function updateSubCategory(data: { name: string; description: string }) {
    if (!subDialog.editing) return;
    const res = await fetch(`/api/subcategories/${subDialog.editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update sub-category");
    await fetchData();
    toast.success(`"${json.data.name}" updated`);
  }

  async function createItem(data: ItemFormData) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, subCategoryId: itemDialog.subCategoryId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create item");
    await fetchData();
    toast.success(`"${json.data.name}" created`);
  }

  async function updateItem(data: ItemFormData) {
    if (!itemDialog.editing) return;
    const res = await fetch(`/api/items/${itemDialog.editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update item");
    await fetchData();
    toast.success(`"${json.data.name}" updated`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url =
        deleteTarget.type === "category" ? `/api/categories/${deleteTarget.id}` :
        deleteTarget.type === "subcategory" ? `/api/subcategories/${deleteTarget.id}` :
        `/api/items/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        await fetchData();
        toast.success(`"${deleteTarget.name}" deleted`);
      } else {
        toast.error(`Failed to delete ${deleteTarget.type}`);
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (!menuData) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-destructive">Menu not found.</p>
        <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}/venues/${venueId}`} />} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    );
  }

  const canAdd = me ? (isAdmin(me.role) || canOnMenu(me, "ADD", menuId) || canOnVenue(me, "ADD", venueId) || canOnProperty(me, "ADD", id)) : false;
  const canEdit = me ? (isAdmin(me.role) || canOnMenu(me, "EDIT", menuId) || canOnVenue(me, "EDIT", venueId) || canOnProperty(me, "EDIT", id)) : false;
  const canDelete = me ? isAdmin(me.role) : false;

  return (
    <div className="max-w-3xl">
      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/properties/${id}/venues/${venueId}`} />} className="-ml-2 mb-6">
        <ArrowLeft className="size-4" /> {menuData.venue.name}
      </Button>

      {/* Menu header */}
      <div className="mb-8 rounded-xl border p-5">
        {editingMenuInfo ? (
          <form onSubmit={saveMenuInfo} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Optional" value={menuForm.description} onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={menuSaving}>{menuSaving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setEditingMenuInfo(false);
                setMenuForm({ name: menuData.name, description: menuData.description ?? "" });
              }}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{menuData.name}</h1>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${menuData.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {menuData.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {menuData.description && <p className="mt-1 text-sm text-muted-foreground">{menuData.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {menuData.venue.property.name} / {menuData.venue.name}
              </p>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditingMenuInfo(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Categories header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Categories
          <span className="ml-2 text-sm font-normal text-muted-foreground">({menuData.categories.length})</span>
        </h2>
        {canAdd && (
          <Button size="sm" onClick={() => setCategoryDialog({ open: true, editing: null })}>
            <Plus /> Add Category
          </Button>
        )}
      </div>

      {/* Empty state */}
      {menuData.categories.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <Tag className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No categories yet</p>
          {canAdd && (
            <Button size="sm" className="mt-4" onClick={() => setCategoryDialog({ open: true, editing: null })}>
              <Plus /> Add your first category
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {menuData.categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.id);
            return (
              <div key={cat.id} className="overflow-hidden rounded-xl border">
                {/* Category header */}
                <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="font-medium">{cat.name}</span>
                    {!cat.isActive && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Inactive</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {cat.subCategories.length} sub-categor{cat.subCategories.length !== 1 ? "ies" : "y"}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setCategoryDialog({ open: true, editing: cat })}>
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div>
                    {cat.subCategories.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Package2 className="mx-auto mb-2 size-6 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">No sub-categories yet</p>
                        {canAdd && (
                          <button
                            onClick={() => setSubDialog({ open: true, editing: null, categoryId: cat.id })}
                            className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Plus className="size-3" /> Add sub-category
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {cat.subCategories.map((sub) => (
                          <div key={sub.id} className="px-4 py-3">
                            {/* Sub-category header */}
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-medium">{sub.name}</span>
                                {!sub.isActive && (
                                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Inactive</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {sub.items.length} item{sub.items.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setSubDialog({ open: true, editing: sub, categoryId: cat.id })}>
                                    <Pencil className="size-3.5" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setDeleteTarget({ type: "subcategory", id: sub.id, name: sub.name })}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Items */}
                            {sub.items.length > 0 && (
                              <div className="mb-2 flex flex-col gap-1.5 pl-5">
                                {sub.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 hover:bg-muted/20"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{item.name}</span>
                                        {!item.isActive && (
                                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Inactive</span>
                                        )}
                                      </div>
                                      <div className="mt-0.5 flex items-center gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          ${parseFloat(item.basePrice).toFixed(2)}
                                        </span>
                                        {item.variants.length > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            {item.variants.length} variant{item.variants.length !== 1 ? "s" : ""}
                                          </span>
                                        )}
                                        {item.itemAllergens.length > 0 && (
                                          <span className="flex gap-0.5">
                                            {item.itemAllergens.map((ia) => (
                                              <span key={ia.allergen.id} title={ia.allergen.name} className="text-xs">
                                                {ia.allergen.icon ?? ia.allergen.name[0]}
                                              </span>
                                            ))}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 pl-2">
                                      {canEdit && (
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={() => setItemDialog({ open: true, editing: item, subCategoryId: sub.id })}
                                        >
                                          <Pencil className="size-3.5" />
                                          <span className="sr-only">Edit</span>
                                        </Button>
                                      )}
                                      {canDelete && (
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={() => setDeleteTarget({ type: "item", id: item.id, name: item.name })}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="size-3.5" />
                                          <span className="sr-only">Delete</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {canAdd && (
                              <button
                                onClick={() => setItemDialog({ open: true, editing: null, subCategoryId: sub.id })}
                                className="ml-5 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Plus className="size-3" /> Add item
                              </button>
                            )}
                          </div>
                        ))}

                        {canAdd && (
                          <div className="px-4 py-2">
                            <button
                              onClick={() => setSubDialog({ open: true, editing: null, categoryId: cat.id })}
                              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Plus className="size-3" /> Add sub-category
                            </button>
                          </div>
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
        title={subDialog.editing ? "Edit Sub-Category" : "Add Sub-Category"}
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

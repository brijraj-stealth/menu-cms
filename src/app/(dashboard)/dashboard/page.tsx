"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Plus, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type MeData, isAdmin } from "@/lib/permissions";

interface Menu {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
  _count: { categories: number };
  venue: {
    id: string;
    name: string;
    property: { id: string; name: string; slug: string };
  };
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

function MenuCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="h-20 animate-pulse bg-neutral-100" />
      <div className="p-4">
        <div className="h-4 w-36 animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-8 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}

function NewMenuDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (menu: Menu) => void;
}) {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ propertyId: "", venueId: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ propertyId: "", venueId: "", name: "", description: "" });
      setVenues([]);
      setError(null);
      fetch("/api/properties").then((r) => r.json()).then((j) => { if (j.data) setProperties(j.data); });
    }
  }, [open]);

  useEffect(() => {
    if (!form.propertyId) { setVenues([]); return; }
    setForm((f) => ({ ...f, venueId: "" }));
    fetch(`/api/venues?propertyId=${form.propertyId}`).then((r) => r.json()).then((j) => { if (j.data) setVenues(j.data); });
  }, [form.propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.venueId) { setError("Select a venue"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description || undefined, venueId: form.venueId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create menu");
      toast.success(`"${json.data.name}" created`);
      onCreated(json.data);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create menu");
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
            <label className="text-sm font-medium text-neutral-700">Property *</label>
            <select
              value={form.propertyId}
              onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
              required
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            >
              <option value="">Select property…</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Venue *</label>
            <select
              value={form.venueId}
              onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}
              required
              disabled={!venues.length}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 disabled:opacity-50"
            >
              <option value="">{form.propertyId ? "Select venue…" : "Select a property first"}</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Menu name *</label>
            <Input
              placeholder="e.g. Dinner Menu, Cocktail Menu"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <Input
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
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

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  async function fetchAll() {
    const [meRes, menuRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/menus"),
    ]);
    const [meJson, menuJson] = await Promise.all([meRes.json(), menuRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (menuJson.data) setMenus(menuJson.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const canCreate = me ? isAdmin(me.role) : false;

  // Group menus by property
  const grouped = menus.reduce<Record<string, { property: Menu["venue"]["property"]; menus: Menu[] }>>((acc, m) => {
    const pid = m.venue.property.id;
    if (!acc[pid]) acc[pid] = { property: m.venue.property, menus: [] };
    acc[pid].menus.push(m);
    return acc;
  }, {});

  const propertyGroups = Object.values(grouped);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Menus</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {loading ? "Loading…" : `${menus.length} menu${menus.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setNewMenuOpen(true)}
            className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
          >
            <Plus className="size-3.5" /> New Menu
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-8">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="mb-3 h-4 w-40 animate-pulse rounded bg-neutral-100" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, j) => <MenuCardSkeleton key={j} />)}
              </div>
            </div>
          ))}
        </div>
      ) : menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-20">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <BookOpen className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No menus yet</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-400">
            Create your first menu to start building your digital menu experience.
          </p>
          {canCreate && (
            <Button
              onClick={() => setNewMenuOpen(true)}
              className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
            >
              <Plus className="size-3.5" /> Create your first menu
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {propertyGroups.map(({ property, menus: groupMenus }) => (
            <div key={property.id}>
              {/* Property section header */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 hover:text-neutral-900"
                >
                  {property.name}
                  <ChevronRight className="size-3.5 text-neutral-400" />
                </button>
                <span className="text-xs text-neutral-400">
                  {groupMenus.length} menu{groupMenus.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupMenus.map((m) => {
                  const color = cardColor(m.name);
                  const initial = m.name[0]?.toUpperCase() ?? "M";
                  return (
                    <div
                      key={m.id}
                      className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white"
                    >
                      {/* Banner */}
                      <div className={`relative flex h-20 items-center justify-center ${color}`}>
                        <span className="select-none text-3xl font-bold text-white/60">{initial}</span>
                        <div className="absolute bottom-2 left-2">
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${m.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                            {m.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-neutral-900">{m.name}</h3>
                        <p className="mt-0.5 text-xs text-neutral-400">{m.venue.name}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-neutral-400">
                          <Tag className="size-3" />
                          {m._count.categories} categor{m._count.categories !== 1 ? "ies" : "y"}
                        </div>
                        <div className="mt-3">
                          <Button
                            render={<Link href={`/dashboard/properties/${m.venue.property.id}/venues/${m.venue.id}/menus/${m.id}`} />}
                            className="h-8 w-full gap-1.5 bg-neutral-900 text-[13px] text-white hover:bg-neutral-800"
                          >
                            Edit Menu <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewMenuDialog
        open={newMenuOpen}
        onOpenChange={setNewMenuOpen}
        onCreated={(menu) => setMenus((prev) => [menu, ...prev])}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Building2, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type MeData, isAdmin } from "@/lib/permissions";

interface Property {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  logo: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { venues: number };
  menusCount: number;
  itemsCount: number;
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white overflow-hidden">
      <div className="border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="h-7 w-48 animate-pulse rounded bg-neutral-100" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-0">
          <div className="size-8 animate-pulse rounded-md bg-neutral-100 shrink-0" />
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
          <div className="ml-auto flex gap-8">
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-8 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-8 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-8 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
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

export default function PropertiesPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    const [meRes, propsRes] = await Promise.all([fetch("/api/me"), fetch("/api/properties")]);
    const [meJson, propsJson] = await Promise.all([meRes.json(), propsRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (propsJson.data) setProperties(propsJson.data);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location, description }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create property"); return; }
      setProperties((prev) => [...prev, json.data]);
      setOpen(false);
      setName(""); setLocation(""); setDescription("");
      toast.success(`"${json.data.name}" created`);
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = me ? isAdmin(me.role) : false;

  const filtered = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalVenues = properties.reduce((a, p) => a + p._count.venues, 0);
  const totalMenus = properties.reduce((a, p) => a + p.menusCount, 0);
  const totalItems = properties.reduce((a, p) => a + p.itemsCount, 0);
  const activeCount = properties.filter((p) => p.isActive).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Properties</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {loading ? "Loading…" : `${properties.length} propert${properties.length !== 1 ? "ies" : "y"} · managed from this console`}
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setLocation(""); setDescription(""); setError(null); } }}>
            <DialogTrigger
              render={
                <Button className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  <Plus className="size-3.5" /> New property
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Property</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Property name *</label>
                  <Input
                    placeholder="e.g. Grand Hyatt Mumbai"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Location</label>
                  <Input
                    placeholder="e.g. Monterey, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Description</label>
                  <Input
                    placeholder="Optional short description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={submitting} className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                    {submitting ? "Creating…" : "Create Property"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          {[
            { label: "PROPERTIES", value: properties.length, sub: `${activeCount} active` },
            { label: "VENUES", value: totalVenues, sub: "across all properties" },
            { label: "MENUS", value: totalMenus, sub: "total" },
            { label: "ITEMS", value: totalItems, sub: "live on menus" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-neutral-200/80 bg-white px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
              <p className="mt-0.5 text-[12px] text-neutral-400">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-20">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <Building2 className="size-6 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">No properties yet</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-neutral-400">
            Properties represent your restaurant brands or hotel groups.
          </p>
          {canCreate && (
            <Button
              onClick={() => setOpen(true)}
              className="mt-5 h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800"
            >
              <Plus className="size-3.5" /> Create your first property
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200/80 bg-white overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-neutral-700">All properties</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-[12px] text-neutral-600">
                <Filter className="size-3" /> Filter
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 w-44 rounded-md border border-neutral-200 bg-white pl-7 pr-3 text-[12px] text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_160px_64px_64px_64px] gap-0 border-b border-neutral-100 px-4 py-2">
            <div className="w-8" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Name</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Location</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Venues</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Menus</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Items</p>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-400">No properties match your search.</p>
          ) : (
            filtered.map((p) => {
              const color = cardColor(p.name);
              const initial = p.name[0]?.toUpperCase() ?? "P";
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/properties/${p.id}`}
                  className="grid grid-cols-[auto_1fr_160px_64px_64px_64px] items-center gap-0 border-b border-neutral-100 px-4 py-3 last:border-0 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-8 mr-3">
                    <div className={`size-8 rounded-md flex items-center justify-center overflow-hidden ${color}`}>
                      {p.logo ? (
                        <img src={p.logo} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-bold text-white/80">{initial}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-neutral-900">{p.name}</p>
                  </div>
                  <p className="text-[13px] text-neutral-500">{p.location ?? "—"}</p>
                  <p className="text-right text-[13px] text-neutral-700">{p._count.venues}</p>
                  <p className="text-right text-[13px] text-neutral-700">{p.menusCount}</p>
                  <p className="text-right text-[13px] text-neutral-700">{p.itemsCount}</p>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

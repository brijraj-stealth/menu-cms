"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Building2, MapPin, ChevronRight } from "lucide-react";
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
  description: string | null;
  logo: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { venues: number };
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

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="aspect-square animate-pulse bg-neutral-100" />
          <div className="p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-neutral-100" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-neutral-100" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PropertiesPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name, description }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create property"); return; }
      setProperties((prev) => [json.data, ...prev]);
      setOpen(false);
      setName(""); setDescription("");
      toast.success(`"${json.data.name}" created`);
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = me ? isAdmin(me.role) : false;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Properties</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {loading ? "Loading…" : `${properties.length} propert${properties.length !== 1 ? "ies" : "y"}`}
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setDescription(""); setError(null); } }}>
            <DialogTrigger
              render={
                <Button className="h-8 gap-1.5 bg-neutral-900 px-3.5 text-[13px] text-white hover:bg-neutral-800">
                  <Plus className="size-3.5" /> New Property
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

      {loading ? (
        <GridSkeleton />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const color = cardColor(p.name);
            const initial = p.name[0]?.toUpperCase() ?? "P";
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
                {/* Square image */}
                <div className={`relative aspect-square flex items-center justify-center overflow-hidden ${color}`}>
                  {p.logo ? (
                    <img src={p.logo} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="select-none text-7xl font-bold text-white/50">{initial}</span>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${p.isActive ? "bg-white/90 text-emerald-700" : "bg-white/70 text-neutral-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">{p.name}</h3>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <MapPin className="size-3" />
                      {p._count.venues} venue{p._count.venues !== 1 ? "s" : ""}
                    </span>
                    <Button
                      size="sm"
                      render={<Link href={`/dashboard/properties/${p.id}`} />}
                      className="h-7 gap-1 bg-neutral-900 px-2.5 text-xs text-white hover:bg-neutral-800"
                    >
                      Open Property <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

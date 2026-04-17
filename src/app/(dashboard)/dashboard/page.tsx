"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type MeData, isAdmin, canOnProperty } from "@/lib/permissions";

interface Property {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count: { venues: number };
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.75" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-4 w-8 rounded bg-muted" />
          <div className="ml-auto h-5 w-14 rounded-full bg-muted" />
          <div className="flex gap-1">
            <div className="size-7 rounded bg-muted" />
            <div className="size-7 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchAll() {
    const [meRes, propsRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/properties"),
    ]);
    const [meJson, propsJson] = await Promise.all([meRes.json(), propsRes.json()]);
    if (meJson.data) setMe(meJson.data);
    if (propsJson.data) setProperties(propsJson.data);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

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
      setName("");
      setDescription("");
      toast.success(`"${json.data.name}" created`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setProperties((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        toast.success(`"${deleteTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete property");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const canCreate = me ? isAdmin(me.role) : false;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your restaurant properties.</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Properties
          {!loading && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({properties.length})
            </span>
          )}
        </h2>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus />
                  Add Property
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    placeholder="e.g. Grand Hotel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Optional description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create Property"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : properties.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No properties yet</p>
          {canCreate ? (
            <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
              <Plus /> Add your first property
            </Button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/70">Contact an admin to add properties.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Venues</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {properties.map((p) => {
                const canEdit = me ? canOnProperty(me, "EDIT", p.id) : false;
                const canDelete = me ? isAdmin(me.role) : false;
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => router.push(`/dashboard/properties/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p._count.venues}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/dashboard/properties/${p.id}`} />}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(p)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete property?"
        description={`"${deleteTarget?.name}" and all its venues, menus, and items will be permanently deleted. This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

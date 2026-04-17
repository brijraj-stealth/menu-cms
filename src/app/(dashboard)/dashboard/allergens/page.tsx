"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Leaf } from "lucide-react";
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

interface Allergen {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.75" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <div className="size-8 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="ml-auto flex gap-1">
            <div className="size-7 rounded bg-muted" />
            <div className="size-7 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AllergensPage() {
  const { data: session } = useSession();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Allergen | null>(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Allergen | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage =
    session?.user.role === "SUPER_ADMIN" || session?.user.role === "ADMIN";

  async function fetchAllergens() {
    const res = await fetch("/api/allergens", { cache: "no-store" });
    const json = await res.json();
    if (json.data) setAllergens(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchAllergens(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", icon: "" });
    setError(null);
    setOpen(true);
  }

  function openEdit(a: Allergen) {
    setEditing(a);
    setForm({ name: a.name, description: a.description ?? "", icon: a.icon ?? "" });
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/allergens/${editing.id}` : "/api/allergens";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save allergen"); return; }
      await fetchAllergens();
      setOpen(false);
      toast.success(editing ? `"${form.name}" updated` : `"${form.name}" created`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/allergens/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setAllergens((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        toast.success(`"${deleteTarget.name}" deleted`);
      } else {
        toast.error("Failed to delete allergen");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Allergens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global allergens that can be applied to any menu item.
          {!canManage && (
            <span className="ml-1 text-muted-foreground/70">(View only — contact an admin to make changes)</span>
          )}
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {!loading && `${allergens.length} allergen${allergens.length !== 1 ? "s" : ""}`}
        </span>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={<Button size="sm"><Plus />Add Allergen</Button>}
              onClick={openCreate}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Allergen" : "Add Allergen"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex w-16 flex-col gap-1.5">
                    <label className="text-sm font-medium">Icon</label>
                    <Input
                      placeholder="🥛"
                      value={form.icon}
                      onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                      className="text-center text-lg"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-sm font-medium">Name *</label>
                    <Input
                      placeholder="e.g. Dairy"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
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
                    {submitting ? "Saving…" : editing ? "Save Changes" : "Create Allergen"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : allergens.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <Leaf className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No allergens yet</p>
          {canManage && (
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus /> Add your first allergen
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Icon</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                {canManage && (
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {allergens.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xl">{a.icon ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.description ?? "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}>
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(a)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete allergen?"
        description={`"${deleteTarget?.name}" will be removed from all menu items. This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

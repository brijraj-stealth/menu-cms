import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  showAddToCart: z.boolean().optional(),
  showAllergenInfo: z.boolean().optional(),
  showTaxInfo: z.boolean().optional(),
  superCategoryId: z.string().nullable().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function checkAccess(userId: string, categoryId: string, permission: string) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { menuId: true, menu: { select: { venueId: true, venue: { select: { propertyId: true } } } } },
  });
  if (!cat) return { ok: false, notFound: true };

  const [ma, va, pa] = await Promise.all([
    prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId, menuId: cat.menuId } }, select: { permissions: true } }),
    prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId, venueId: cat.menu.venueId } }, select: { permissions: true } }),
    prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId, propertyId: cat.menu.venue.propertyId } }, select: { permissions: true } }),
  ]);

  const ok = ma?.permissions.includes(permission as "EDIT") || va?.permissions.includes(permission as "EDIT") || pa?.permissions.includes(permission as "EDIT") || false;
  return { ok, notFound: false };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    if (!isAdmin(session.user.role as string)) {
      const { ok, notFound } = await checkAccess(session.user.id, id, "EDIT");
      if (notFound) return Response.json({ error: "Not found" }, { status: 404 });
      if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const before = await prisma.category.findUnique({ where: { id }, select: { name: true, description: true, sortOrder: true, isActive: true, showAddToCart: true, showAllergenInfo: true, showTaxInfo: true, superCategoryId: true } });

    const category = await prisma.category.update({ where: { id }, data: parsed.data });

    if (before) {
      const tracked = ["name", "description", "sortOrder", "isActive", "showAddToCart", "showAllergenInfo", "showTaxInfo", "superCategoryId"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (parsed.data as Record<string, unknown>)[f] && (parsed.data as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (parsed.data as Record<string, unknown>)[f] ?? null }));
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "updated",
          entityType: "category",
          entityId: id,
          metadata: { entityName: category.name, changes },
        },
      });
    }

    return Response.json({ data: category });
  } catch {
    return Response.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const category = await prisma.category.findUnique({ where: { id }, select: { name: true } });
    await prisma.category.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "deleted",
        entityType: "category",
        entityId: id,
        metadata: { entityName: category?.name ?? id },
      },
    });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete category" }, { status: 500 });
  }
}

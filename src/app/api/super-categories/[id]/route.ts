import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function checkAccess(userId: string, superCategoryId: string, permission: string) {
  const sc = await prisma.superCategory.findUnique({
    where: { id: superCategoryId },
    select: { menuId: true, menu: { select: { venueId: true, venue: { select: { propertyId: true } } } } },
  });
  if (!sc) return { ok: false, notFound: true };

  const [ma, va, pa] = await Promise.all([
    prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId, menuId: sc.menuId } }, select: { permissions: true } }),
    prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId, venueId: sc.menu.venueId } }, select: { permissions: true } }),
    prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId, propertyId: sc.menu.venue.propertyId } }, select: { permissions: true } }),
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

    const superCategory = await prisma.superCategory.update({ where: { id }, data: parsed.data });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "updated",
        entityType: "superCategory",
        entityId: id,
        metadata: { entityName: superCategory.name },
      },
    });

    return Response.json({ data: superCategory });
  } catch {
    return Response.json({ error: "Failed to update super category" }, { status: 500 });
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
    const sc = await prisma.superCategory.findUnique({ where: { id }, select: { name: true } });
    // Unlink categories before deleting
    await prisma.category.updateMany({ where: { superCategoryId: id }, data: { superCategoryId: null } });
    await prisma.superCategory.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "deleted",
        entityType: "superCategory",
        entityId: id,
        metadata: { entityName: sc?.name ?? id },
      },
    });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete super category" }, { status: 500 });
  }
}

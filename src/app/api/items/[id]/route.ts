import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  price: z.number().min(0),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  basePrice: z.number().min(0).optional(),
  image: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  allergenIds: z.array(z.string()).optional(),
  variants: z.array(variantSchema).optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function checkAccess(userId: string, itemId: string, permission: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      subCategory: {
        select: {
          category: {
            select: { menuId: true, menu: { select: { venueId: true, venue: { select: { propertyId: true } } } } },
          },
        },
      },
    },
  });
  if (!item) return { ok: false, notFound: true };

  const { menuId } = item.subCategory.category;
  const { venueId } = item.subCategory.category.menu;
  const { propertyId } = item.subCategory.category.menu.venue;

  const [ma, va, pa] = await Promise.all([
    prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId, menuId } }, select: { permissions: true } }),
    prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId, venueId } }, select: { permissions: true } }),
    prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId, propertyId } }, select: { permissions: true } }),
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

    const { allergenIds, variants, ...itemData } = parsed.data;

    const before = await prisma.item.findUnique({ where: { id }, select: { name: true, description: true, basePrice: true, image: true, isActive: true, sortOrder: true } });

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({ where: { id }, data: itemData });

      if (allergenIds !== undefined) {
        await tx.itemAllergen.deleteMany({ where: { itemId: id } });
        if (allergenIds.length > 0) {
          await tx.itemAllergen.createMany({
            data: allergenIds.map((allergenId) => ({ itemId: id, allergenId })),
          });
        }
      }

      if (variants !== undefined) {
        const incomingIds = variants.filter((v) => v.id).map((v) => v.id as string);
        await tx.itemVariant.deleteMany({ where: { itemId: id, id: { notIn: incomingIds } } });
        for (const v of variants) {
          if (v.id) {
            await tx.itemVariant.update({
              where: { id: v.id },
              data: { name: v.name, price: v.price, isActive: v.isActive },
            });
          } else {
            await tx.itemVariant.create({
              data: { name: v.name, price: v.price, isActive: v.isActive ?? true, itemId: id },
            });
          }
        }
      }

      return updated;
    });

    if (before) {
      const tracked = ["name", "description", "basePrice", "image", "isActive", "sortOrder"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (itemData as Record<string, unknown>)[f] && (itemData as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (itemData as Record<string, unknown>)[f] ?? null }));
      const wasArchived = before.isActive === true && itemData.isActive === false;
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: wasArchived ? "archived" : "updated",
          entityType: "item",
          entityId: id,
          metadata: { entityName: item.name, changes },
        },
      });
    }

    return Response.json({ data: item });
  } catch {
    return Response.json({ error: "Failed to update item" }, { status: 500 });
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
    const item = await prisma.item.findUnique({ where: { id }, select: { name: true } });
    await prisma.item.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "deleted",
        entityType: "item",
        entityId: id,
        metadata: { entityName: item?.name ?? id },
      },
    });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete item" }, { status: 500 });
  }
}

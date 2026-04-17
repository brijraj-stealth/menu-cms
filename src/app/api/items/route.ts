import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const variantSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  isActive: z.boolean().optional().default(true),
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  basePrice: z.number().min(0),
  image: z.string().url().nullable().optional(),
  subCategoryId: z.string().min(1, "Sub-category ID is required"),
  allergenIds: z.array(z.string()).optional().default([]),
  variants: z.array(variantSchema).optional().default([]),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { subCategoryId, allergenIds, variants, ...data } = parsed.data;

    if (!isAdmin(session.user.role as string)) {
      const sub = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
        select: { category: { select: { menuId: true, menu: { select: { venueId: true, venue: { select: { propertyId: true } } } } } } },
      });
      if (!sub) return Response.json({ error: "Sub-category not found" }, { status: 404 });

      const { menuId } = sub.category;
      const { venueId } = sub.category.menu;
      const { propertyId } = sub.category.menu.venue;

      const [ma, va, pa] = await Promise.all([
        prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId: session.user.id, menuId } }, select: { permissions: true } }),
        prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId: session.user.id, venueId } }, select: { permissions: true } }),
        prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId: session.user.id, propertyId } }, select: { permissions: true } }),
      ]);
      const hasAdd = ma?.permissions.includes("ADD") || va?.permissions.includes("ADD") || pa?.permissions.includes("ADD");
      if (!hasAdd) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          ...data,
          subCategoryId,
          itemAllergens: allergenIds.length > 0
            ? { createMany: { data: allergenIds.map((allergenId) => ({ allergenId })) } }
            : undefined,
          variants: variants.length > 0
            ? { createMany: { data: variants.map((v) => ({ name: v.name, price: v.price, isActive: v.isActive })) } }
            : undefined,
        },
        include: {
          variants: true,
          itemAllergens: { include: { allergen: true } },
        },
      });
      return created;
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "created",
        entityType: "item",
        entityId: item.id,
        metadata: { entityName: item.name },
      },
    });

    return Response.json({ data: item }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create item" }, { status: 500 });
  }
}

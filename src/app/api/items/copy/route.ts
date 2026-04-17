import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  itemIds: z.array(z.string()).min(1, "Select at least one item"),
  targetSubCategoryId: z.string().min(1, "Target section is required"),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { itemIds, targetSubCategoryId } = parsed.data;

    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      include: {
        variants: true,
        itemAllergens: true,
      },
    });

    const maxOrder = await prisma.item.aggregate({
      where: { subCategoryId: targetSubCategoryId },
      _max: { sortOrder: true },
    });
    let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created = await prisma.$transaction(
      items.map((item) => {
        const order = nextOrder++;
        return prisma.item.create({
          data: {
            name: item.name,
            description: item.description,
            basePrice: item.basePrice,
            image: item.image,
            isActive: item.isActive,
            sortOrder: order,
            subCategoryId: targetSubCategoryId,
            variants: item.variants.length > 0
              ? { createMany: { data: item.variants.map((v) => ({ name: v.name, price: v.price, isActive: v.isActive })) } }
              : undefined,
            itemAllergens: item.itemAllergens.length > 0
              ? { createMany: { data: item.itemAllergens.map((ia) => ({ allergenId: ia.allergenId })) } }
              : undefined,
          },
        });
      })
    );

    for (const item of created) {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "copied",
          entityType: "item",
          entityId: item.id,
          metadata: { entityName: item.name },
        },
      });
    }

    return Response.json({ data: { copied: created.length } }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to copy items" }, { status: 500 });
  }
}

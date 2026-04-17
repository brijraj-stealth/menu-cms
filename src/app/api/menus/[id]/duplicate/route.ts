import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  name: z.string().min(1, "Name is required"),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const source = await prisma.menu.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            subCategories: {
              include: {
                items: {
                  include: {
                    variants: true,
                    itemAllergens: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!source) return Response.json({ error: "Menu not found" }, { status: 404 });

    const newMenu = await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.create({
        data: {
          name: parsed.data.name,
          description: source.description,
          venueId: parsed.data.venueId,
          phoneNumber: source.phoneNumber,
          phoneButtonText: source.phoneButtonText,
          videoSectionHeader: source.videoSectionHeader,
          videoSectionSubheader: source.videoSectionSubheader,
          featuredSectionHeader: source.featuredSectionHeader,
          featuredSectionSubheader: source.featuredSectionSubheader,
        },
      });

      for (const cat of source.categories) {
        const newCat = await tx.category.create({
          data: {
            name: cat.name,
            description: cat.description,
            sortOrder: cat.sortOrder,
            isActive: cat.isActive,
            menuId: menu.id,
          },
        });

        for (const sub of cat.subCategories) {
          const newSub = await tx.subCategory.create({
            data: {
              name: sub.name,
              description: sub.description,
              sortOrder: sub.sortOrder,
              displayMode: sub.displayMode,
              isActive: sub.isActive,
              categoryId: newCat.id,
            },
          });

          for (const item of sub.items) {
            await tx.item.create({
              data: {
                name: item.name,
                description: item.description,
                basePrice: item.basePrice,
                image: item.image,
                sortOrder: item.sortOrder,
                isActive: item.isActive,
                subCategoryId: newSub.id,
                variants: item.variants.length > 0
                  ? { createMany: { data: item.variants.map((v) => ({ name: v.name, price: v.price, isActive: v.isActive })) } }
                  : undefined,
                itemAllergens: item.itemAllergens.length > 0
                  ? { createMany: { data: item.itemAllergens.map((ia) => ({ allergenId: ia.allergenId })) } }
                  : undefined,
              },
            });
          }
        }
      }

      return menu;
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "duplicated",
        entityType: "menu",
        entityId: newMenu.id,
        metadata: { entityName: newMenu.name, changes: [{ field: "source", old: source.name, new: newMenu.name }] },
      },
    });

    return Response.json({ data: newMenu }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to duplicate menu" }, { status: 500 });
  }
}

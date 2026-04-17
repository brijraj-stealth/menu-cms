import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens").optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  phoneButtonText: z.string().optional().nullable(),
  videoSectionHeader: z.string().optional().nullable(),
  videoSectionSubheader: z.string().optional().nullable(),
  featuredSectionHeader: z.string().optional().nullable(),
  featuredSectionSubheader: z.string().optional().nullable(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function checkMenuAccess(userId: string, menuId: string, permission: string) {
  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
    select: { venueId: true, venue: { select: { propertyId: true } } },
  });
  if (!menu) return { ok: false, notFound: true };

  const [ma, va, pa] = await Promise.all([
    prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId, menuId } }, select: { permissions: true } }),
    prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId, venueId: menu.venueId } }, select: { permissions: true } }),
    prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId, propertyId: menu.venue.propertyId } }, select: { permissions: true } }),
  ]);

  const ok = ma?.permissions.includes(permission as "EDIT") || va?.permissions.includes(permission as "EDIT") || pa?.permissions.includes(permission as "EDIT") || false;
  return { ok, notFound: false };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const menu = await prisma.menu.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            propertyId: true,
            property: { select: { id: true, name: true, slug: true } },
          },
        },
        videos: { orderBy: { sortOrder: "asc" } },
        featuredImages: { orderBy: { sortOrder: "asc" } },
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            subCategories: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                  include: {
                    variants: { orderBy: { createdAt: "asc" } },
                    itemAllergens: { include: { allergen: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!menu) return Response.json({ error: "Menu not found" }, { status: 404 });

    if (!isAdmin(session.user.role as string)) {
      const [ma, va, pa] = await Promise.all([
        prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId: session.user.id, menuId: id } } }),
        prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId: session.user.id, venueId: menu.venueId } } }),
        prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId: session.user.id, propertyId: menu.venue.propertyId } } }),
      ]);
      if (!ma && !va && !pa) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ data: menu }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
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
      const { ok, notFound } = await checkMenuAccess(session.user.id, id, "EDIT");
      if (notFound) return Response.json({ error: "Not found" }, { status: 404 });
      if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const before = await prisma.menu.findUnique({ where: { id }, select: { name: true, description: true, isActive: true } });

    const menu = await prisma.menu.update({ where: { id }, data: parsed.data });

    if (before) {
      const tracked = ["name", "description", "isActive"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (parsed.data as Record<string, unknown>)[f] && (parsed.data as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (parsed.data as Record<string, unknown>)[f] ?? null }));
      const wasPublished = before.isActive === false && parsed.data.isActive === true;
      const wasArchived = before.isActive === true && parsed.data.isActive === false;
      const action = wasPublished ? "published" : wasArchived ? "archived" : "updated";
      void prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action,
          entityType: "menu",
          entityId: id,
          metadata: { entityName: menu.name, changes },
        },
      });
    }

    return Response.json({ data: menu });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return Response.json({ error: "This slug is already in use" }, { status: 409 });
    }
    return Response.json({ error: "Failed to update menu" }, { status: 500 });
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
    const menu = await prisma.menu.findUnique({ where: { id }, select: { name: true } });
    await prisma.menu.delete({ where: { id } });
    void prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "deleted",
        entityType: "menu",
        entityId: id,
        metadata: { entityName: menu?.name ?? id },
      },
    });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete menu" }, { status: 500 });
  }
}

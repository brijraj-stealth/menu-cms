import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Permission } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  venueId: z.string().min(1, "Venue ID is required"),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function hasVenueAccess(userId: string, venueId: string, permission?: string) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { propertyId: true } });
  if (!venue) return false;
  const [va, pa] = await Promise.all([
    prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId, venueId } }, select: { permissions: true } }),
    prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId, propertyId: venue.propertyId } }, select: { permissions: true } }),
  ]);
  if (!permission) return !!(va || pa);
  return va?.permissions.includes(permission as "ADD") || pa?.permissions.includes(permission as "ADD") || false;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get("venueId");

  try {
    if (!venueId) {
      const include = {
        _count: { select: { categories: true } },
        venue: {
          select: {
            id: true, name: true,
            property: { select: { id: true, name: true, slug: true } },
          },
        },
      } as const;

      if (isAdmin(session.user.role as string)) {
        const menus = await prisma.menu.findMany({
          orderBy: { updatedAt: "desc" },
          include,
        });
        return Response.json({ data: menus }, { headers: { "Cache-Control": "no-store" } });
      }

      const [venueAccess, propAccess] = await Promise.all([
        prisma.userVenueAccess.findMany({ where: { userId: session.user.id }, select: { venueId: true } }),
        prisma.userPropertyAccess.findMany({
          where: { userId: session.user.id },
          include: { property: { select: { venues: { select: { id: true } } } } },
        }),
      ]);
      const venueIds = new Set([
        ...venueAccess.map((a) => a.venueId),
        ...propAccess.flatMap((pa) => pa.property.venues.map((v) => v.id)),
      ]);
      const menus = await prisma.menu.findMany({
        where: { venueId: { in: [...venueIds] } },
        orderBy: { updatedAt: "desc" },
        include,
      });
      return Response.json({ data: menus }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!isAdmin(session.user.role as string)) {
      const ok = await hasVenueAccess(session.user.id, venueId);
      if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const menus = await prisma.menu.findMany({
      where: { venueId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { categories: true } } },
    });

    if (menus.length === 0) return Response.json({ data: [] }, { headers: { "Cache-Control": "no-store" } });

    const menuIds = menus.map((m) => m.id);

    // Count items per menu through categories → subCategories → items
    const itemCounts = await prisma.$queryRaw<Array<{ menuId: string; count: bigint }>>`
      SELECT c."menuId", COUNT(i.id)::int as count
      FROM "Category" c
      LEFT JOIN "SubCategory" sc ON sc."categoryId" = c.id
      LEFT JOIN "Item" i ON i."subCategoryId" = sc.id
      WHERE c."menuId" = ANY(${menuIds})
      GROUP BY c."menuId"
    `;

    const data = menus.map((m) => ({
      ...m,
      itemsCount: Number(itemCounts.find((c) => c.menuId === m.id)?.count ?? 0),
    }));

    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Failed to fetch menus" }, { status: 500 });
  }
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

    const { venueId, ...data } = parsed.data;

    if (!isAdmin(session.user.role as string)) {
      const ok = await hasVenueAccess(session.user.id, venueId, "ADD");
      if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const menu = await prisma.menu.create({
      data: { ...data, venueId },
      include: {
        _count: { select: { categories: true } },
        venue: {
          select: {
            id: true, name: true,
            property: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    // Cascade: give every user with venue or property access an explicit menu access record
    const propertyId = menu.venue.property.id;
    const [vAccessList, pAccessList] = await Promise.all([
      prisma.userVenueAccess.findMany({ where: { venueId }, select: { userId: true, permissions: true } }),
      prisma.userPropertyAccess.findMany({ where: { propertyId }, select: { userId: true, permissions: true } }),
    ]);
    const accessMap = new Map<string, Permission[]>();
    for (const a of pAccessList) accessMap.set(a.userId, a.permissions);
    for (const a of vAccessList) accessMap.set(a.userId, a.permissions); // venue overrides property
    if (accessMap.size > 0) {
      await prisma.userMenuAccess.createMany({
        data: [...accessMap.entries()].map(([userId, permissions]) => ({
          userId,
          menuId: menu.id,
          permissions,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "created",
        entityType: "menu",
        entityId: menu.id,
        metadata: { entityName: menu.name },
      },
    });

    return Response.json({ data: { ...menu, itemsCount: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create menu" }, { status: 500 });
  }
}

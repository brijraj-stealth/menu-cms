import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
});

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const role = session.user.role as string;

    let properties;
    if (isAdmin(role)) {
      properties = await prisma.property.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { venues: true } } },
      });
    } else {
      const access = await prisma.userPropertyAccess.findMany({
        where: { userId: session.user.id },
        select: { propertyId: true },
      });
      const propertyIds = access.map((a) => a.propertyId);
      properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { venues: true } } },
      });
    }

    if (properties.length === 0) return Response.json({ data: [] });

    const propertyIds = properties.map((p) => p.id);

    // Menus count per property via raw SQL
    const menuCounts = await prisma.$queryRaw<Array<{ propertyId: string; count: bigint }>>`
      SELECT v."propertyId", COUNT(m.id)::int as count
      FROM "Venue" v
      LEFT JOIN "Menu" m ON m."venueId" = v.id
      WHERE v."propertyId" = ANY(${propertyIds})
      GROUP BY v."propertyId"
    `;

    // Items count per property via raw SQL
    const itemCounts = await prisma.$queryRaw<Array<{ propertyId: string; count: bigint }>>`
      SELECT v."propertyId", COUNT(i.id)::int as count
      FROM "Venue" v
      LEFT JOIN "Menu" m ON m."venueId" = v.id
      LEFT JOIN "Category" c ON c."menuId" = m.id
      LEFT JOIN "SubCategory" sc ON sc."categoryId" = c.id
      LEFT JOIN "Item" i ON i."subCategoryId" = sc.id
      WHERE v."propertyId" = ANY(${propertyIds})
      GROUP BY v."propertyId"
    `;

    const data = properties.map((p) => ({
      ...p,
      menusCount: Number(menuCounts.find((c) => c.propertyId === p.id)?.count ?? 0),
      itemsCount: Number(itemCounts.find((c) => c.propertyId === p.id)?.count ?? 0),
    }));

    return Response.json({ data });
  } catch {
    return Response.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, description, location } = parsed.data;
    let slug = slugify(name);

    const existing = await prisma.property.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const property = await prisma.property.create({
      data: { name, description, location, slug },
      include: { _count: { select: { venues: true } } },
    });

    return Response.json({ data: { ...property, menusCount: 0, itemsCount: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create property" }, { status: 500 });
  }
}

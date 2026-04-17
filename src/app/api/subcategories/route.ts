import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category ID is required"),
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

    const { categoryId, ...data } = parsed.data;

    if (!isAdmin(session.user.role as string)) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { menuId: true, menu: { select: { venueId: true, venue: { select: { propertyId: true } } } } },
      });
      if (!cat) return Response.json({ error: "Category not found" }, { status: 404 });

      const [ma, va, pa] = await Promise.all([
        prisma.userMenuAccess.findUnique({ where: { userId_menuId: { userId: session.user.id, menuId: cat.menuId } }, select: { permissions: true } }),
        prisma.userVenueAccess.findUnique({ where: { userId_venueId: { userId: session.user.id, venueId: cat.menu.venueId } }, select: { permissions: true } }),
        prisma.userPropertyAccess.findUnique({ where: { userId_propertyId: { userId: session.user.id, propertyId: cat.menu.venue.propertyId } }, select: { permissions: true } }),
      ]);
      const hasAdd = ma?.permissions.includes("ADD") || va?.permissions.includes("ADD") || pa?.permissions.includes("ADD");
      if (!hasAdd) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const subCategory = await prisma.subCategory.create({ data: { ...data, categoryId } });
    return Response.json({ data: subCategory }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create sub-category" }, { status: 500 });
  }
}

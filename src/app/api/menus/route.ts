import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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
  if (!venueId) return Response.json({ error: "venueId required" }, { status: 400 });

  try {
    if (!isAdmin(session.user.role as string)) {
      const ok = await hasVenueAccess(session.user.id, venueId);
      if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const menus = await prisma.menu.findMany({
      where: { venueId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { categories: true } } },
    });

    return Response.json({ data: menus }, { headers: { "Cache-Control": "no-store" } });
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
      include: { _count: { select: { categories: true } } },
    });

    return Response.json({ data: menu }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create menu" }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  image: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true, slug: true } },
        _count: { select: { menus: true } },
      },
    });
    if (!venue) return Response.json({ error: "Venue not found" }, { status: 404 });

    if (!isAdmin(session.user.role as string)) {
      const access = await prisma.userVenueAccess.findUnique({
        where: { userId_venueId: { userId: session.user.id, venueId: id } },
      });
      const propAccess = await prisma.userPropertyAccess.findUnique({
        where: { userId_propertyId: { userId: session.user.id, propertyId: venue.propertyId } },
      });
      if (!access && !propAccess) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const seqNum = await prisma.venue.count({
      where: { propertyId: venue.propertyId, createdAt: { lte: venue.createdAt } },
    });

    return Response.json({ data: { ...venue, sequenceNumber: seqNum } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Failed to fetch venue" }, { status: 500 });
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
      const access = await prisma.userVenueAccess.findUnique({
        where: { userId_venueId: { userId: session.user.id, venueId: id } },
        select: { permissions: true },
      });
      if (!access?.permissions.includes("EDIT")) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const before = await prisma.venue.findUnique({ where: { id }, select: { name: true, description: true, address: true, isActive: true } });

    const venue = await prisma.venue.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { menus: true } } },
    });

    if (before) {
      const tracked = ["name", "description", "address", "isActive"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (parsed.data as Record<string, unknown>)[f] && (parsed.data as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (parsed.data as Record<string, unknown>)[f] ?? null }));
      void prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "updated",
          entityType: "venue",
          entityId: id,
          metadata: { entityName: venue.name, changes },
        },
      });
    }

    return Response.json({ data: venue });
  } catch {
    return Response.json({ error: "Failed to update venue" }, { status: 500 });
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
    const venue = await prisma.venue.findUnique({ where: { id }, select: { name: true } });
    await prisma.venue.delete({ where: { id } });
    void prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "deleted",
        entityType: "venue",
        entityId: id,
        metadata: { entityName: venue?.name ?? id },
      },
    });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete venue" }, { status: 500 });
  }
}

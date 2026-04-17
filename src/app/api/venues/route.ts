import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  propertyId: z.string().min(1, "Property ID is required"),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  if (!propertyId) return Response.json({ error: "propertyId required" }, { status: 400 });

  try {
    const role = session.user.role as string;

    // STAFF: check they have access to this property
    if (!isAdmin(role)) {
      const access = await prisma.userPropertyAccess.findUnique({
        where: { userId_propertyId: { userId: session.user.id, propertyId } },
      });
      if (!access) return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const venues = await prisma.venue.findMany({
      where: { propertyId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { menus: true } } },
    });

    return Response.json({ data: venues }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Failed to fetch venues" }, { status: 500 });
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

    const { propertyId, ...data } = parsed.data;
    const role = session.user.role as string;

    // STAFF: need ADD permission on property
    if (!isAdmin(role)) {
      const access = await prisma.userPropertyAccess.findUnique({
        where: { userId_propertyId: { userId: session.user.id, propertyId } },
        select: { permissions: true },
      });
      if (!access?.permissions.includes("ADD")) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const venue = await prisma.venue.create({
      data: { ...data, propertyId },
      include: { _count: { select: { menus: true } } },
    });

    void prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "created",
        entityType: "venue",
        entityId: venue.id,
        metadata: { entityName: venue.name },
      },
    });

    return Response.json({ data: venue }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create venue" }, { status: 500 });
  }
}

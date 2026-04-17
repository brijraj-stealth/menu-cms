import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Permission } from "@prisma/client";
import { z } from "zod";

const accessSchema = z.object({
  type: z.enum(["property", "venue", "menu"]),
  targetId: z.string().min(1),
  permissions: z.array(z.nativeEnum(Permission)).min(1),
});

const removeSchema = z.object({
  type: z.enum(["property", "venue", "menu"]),
  targetId: z.string().min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [user, properties, propertyAccess, venueAccess, menuAccess] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      prisma.property.findMany({
        orderBy: { name: "asc" },
        include: {
          venues: {
            include: {
              menus: { select: { id: true, name: true, venueId: true } },
            },
          },
        },
      }),
      prisma.userPropertyAccess.findMany({
        where: { userId: id },
        include: { property: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.userVenueAccess.findMany({
        where: { userId: id },
        include: {
          venue: {
            select: { id: true, name: true, propertyId: true },
          },
        },
      }),
      prisma.userMenuAccess.findMany({
        where: { userId: id },
        include: {
          menu: {
            select: { id: true, name: true, venueId: true },
          },
        },
      }),
    ]);

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({
    data: { user, properties, propertyAccess, venueAccess, menuAccess },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = await params;
  const body = await req.json();
  const parsed = accessSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { type, targetId, permissions } = parsed.data;

  if (type === "property") {
    const access = await prisma.userPropertyAccess.upsert({
      where: { userId_propertyId: { userId, propertyId: targetId } },
      update: { permissions },
      create: { userId, propertyId: targetId, permissions },
      include: { property: { select: { id: true, name: true, slug: true } } },
    });
    return Response.json({ data: access });
  }

  if (type === "venue") {
    const access = await prisma.userVenueAccess.upsert({
      where: { userId_venueId: { userId, venueId: targetId } },
      update: { permissions },
      create: { userId, venueId: targetId, permissions },
      include: { venue: { select: { id: true, name: true, propertyId: true } } },
    });
    return Response.json({ data: access });
  }

  const access = await prisma.userMenuAccess.upsert({
    where: { userId_menuId: { userId, menuId: targetId } },
    update: { permissions },
    create: { userId, menuId: targetId, permissions },
    include: { menu: { select: { id: true, name: true, venueId: true } } },
  });
  return Response.json({ data: access });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = await params;
  const body = await req.json();
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { type, targetId } = parsed.data;

  if (type === "property") {
    await prisma.userPropertyAccess.delete({
      where: { userId_propertyId: { userId, propertyId: targetId } },
    });
  } else if (type === "venue") {
    await prisma.userVenueAccess.delete({
      where: { userId_venueId: { userId, venueId: targetId } },
    });
  } else {
    await prisma.userMenuAccess.delete({
      where: { userId_menuId: { userId, menuId: targetId } },
    });
  }

  return Response.json({ data: { ok: true } });
}

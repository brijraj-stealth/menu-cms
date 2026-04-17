import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

async function hasPropertyPermission(
  userId: string,
  propertyId: string,
  action: "VIEW" | "EDIT" | "DELETE"
) {
  const access = await prisma.userPropertyAccess.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
    select: { permissions: true },
  });
  return access?.permissions.includes(action) ?? false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = session.user.role as string;

  if (!isAdmin(role)) {
    const allowed = await hasPropertyPermission(session.user.id, id, "VIEW");
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        venues: { orderBy: { createdAt: "desc" } },
        _count: { select: { venues: true } },
      },
    });

    if (!property) return Response.json({ error: "Property not found" }, { status: 404 });
    return Response.json({ data: property });
  } catch {
    return Response.json({ error: "Failed to fetch property" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = session.user.role as string;

  if (!isAdmin(role)) {
    const allowed = await hasPropertyPermission(session.user.id, id, "EDIT");
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const property = await prisma.property.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { venues: true } } },
    });

    return Response.json({ data: property });
  } catch {
    return Response.json({ error: "Failed to update property" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can delete properties
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.property.delete({ where: { id } });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete property" }, { status: 500 });
  }
}

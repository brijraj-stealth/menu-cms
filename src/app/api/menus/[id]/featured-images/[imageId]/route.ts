import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  url: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { imageId } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const before = await prisma.menuFeaturedImage.findUnique({ where: { id: imageId }, select: { url: true, title: true, sortOrder: true, menuId: true } });
    const image = await prisma.menuFeaturedImage.update({ where: { id: imageId }, data: parsed.data });

    if (before) {
      const tracked = ["url", "title", "sortOrder"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (parsed.data as Record<string, unknown>)[f] && (parsed.data as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (parsed.data as Record<string, unknown>)[f] ?? null }));
      const menu = await prisma.menu.findUnique({ where: { id: before.menuId }, select: { name: true } });
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "updated image on",
          entityType: "menu",
          entityId: before.menuId,
          metadata: { entityName: menu?.name ?? before.menuId, changes },
        },
      });
    }

    return Response.json({ data: image });
  } catch {
    return Response.json({ error: "Failed to update featured image" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { imageId } = await params;

  try {
    const img = await prisma.menuFeaturedImage.findUnique({ where: { id: imageId }, select: { url: true, menuId: true } });
    await prisma.menuFeaturedImage.delete({ where: { id: imageId } });
    if (img) {
      const menu = await prisma.menu.findUnique({ where: { id: img.menuId }, select: { name: true } });
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "removed image from",
          entityType: "menu",
          entityId: img.menuId,
          metadata: { entityName: menu?.name ?? img.menuId, changes: [{ field: "url", old: img.url, new: null }] },
        },
      });
    }
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete featured image" }, { status: 500 });
  }
}

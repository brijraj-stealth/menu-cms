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
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { videoId } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const before = await prisma.menuVideo.findUnique({ where: { id: videoId }, select: { url: true, title: true, sortOrder: true, menuId: true } });
    const video = await prisma.menuVideo.update({ where: { id: videoId }, data: parsed.data });

    if (before) {
      const tracked = ["url", "title", "sortOrder"] as const;
      const changes = tracked
        .filter((f) => before[f] !== (parsed.data as Record<string, unknown>)[f] && (parsed.data as Record<string, unknown>)[f] !== undefined)
        .map((f) => ({ field: f, old: before[f] ?? null, new: (parsed.data as Record<string, unknown>)[f] ?? null }));
      const menu = await prisma.menu.findUnique({ where: { id: before.menuId }, select: { name: true } });
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "updated video on",
          entityType: "menu",
          entityId: before.menuId,
          metadata: { entityName: menu?.name ?? before.menuId, changes },
        },
      });
    }

    return Response.json({ data: video });
  } catch {
    return Response.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { videoId } = await params;

  try {
    const video = await prisma.menuVideo.findUnique({ where: { id: videoId }, select: { url: true, menuId: true } });
    await prisma.menuVideo.delete({ where: { id: videoId } });
    if (video) {
      const menu = await prisma.menu.findUnique({ where: { id: video.menuId }, select: { name: true } });
      await prisma.activityLog.create({
        data: {
          userId: session.user.id as string,
          action: "removed video from",
          entityType: "menu",
          entityId: video.menuId,
          metadata: { entityName: menu?.name ?? video.menuId, changes: [{ field: "url", old: video.url, new: null }] },
        },
      });
    }
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete video" }, { status: 500 });
  }
}

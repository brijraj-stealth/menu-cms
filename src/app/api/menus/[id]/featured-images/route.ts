import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  url: z.string().min(1, "URL is required"),
  title: z.string().optional(),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: menuId } = await params;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const max = await prisma.menuFeaturedImage.aggregate({
      where: { menuId },
      _max: { sortOrder: true },
    });

    const image = await prisma.menuFeaturedImage.create({
      data: {
        menuId,
        url: parsed.data.url,
        title: parsed.data.title,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });

    const menu = await prisma.menu.findUnique({ where: { id: menuId }, select: { name: true } });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id as string,
        action: "added image to",
        entityType: "menu",
        entityId: menuId,
        metadata: { entityName: menu?.name ?? menuId, changes: [{ field: "url", old: null, new: image.url }] },
      },
    });

    return Response.json({ data: image }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to add featured image" }, { status: 500 });
  }
}

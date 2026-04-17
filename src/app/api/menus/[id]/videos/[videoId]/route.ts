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

    const video = await prisma.menuVideo.update({ where: { id: videoId }, data: parsed.data });
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
    await prisma.menuVideo.delete({ where: { id: videoId } });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete video" }, { status: 500 });
  }
}

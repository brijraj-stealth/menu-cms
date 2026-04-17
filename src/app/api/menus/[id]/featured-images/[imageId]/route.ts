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

    const image = await prisma.menuFeaturedImage.update({ where: { id: imageId }, data: parsed.data });
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
    await prisma.menuFeaturedImage.delete({ where: { id: imageId } });
    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to delete featured image" }, { status: 500 });
  }
}

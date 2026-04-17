import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const TYPE_MAP: Record<string, string> = {
    items: "item",
    menus: "menu",
    categories: "category",
    subcategories: "subcategory",
    venues: "venue",
    properties: "property",
    users: "user",
  };

  try {
    const entityType = type && type !== "all" ? TYPE_MAP[type] : undefined;
    const where = entityType ? { entityType } : undefined;

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ data: logs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Failed to fetch activity logs" }, { status: 500 });
  }
}

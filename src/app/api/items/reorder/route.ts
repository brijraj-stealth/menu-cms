import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  orders: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1),
});

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    await prisma.$transaction(
      parsed.data.orders.map(({ id, sortOrder }) =>
        prisma.item.update({ where: { id }, data: { sortOrder } })
      )
    );

    return Response.json({ data: { success: true } });
  } catch {
    return Response.json({ error: "Failed to reorder items" }, { status: 500 });
  }
}

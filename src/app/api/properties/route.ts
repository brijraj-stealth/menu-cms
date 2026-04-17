import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const role = session.user.role as string;

    if (isAdmin(role)) {
      const properties = await prisma.property.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { venues: true } } },
      });
      return Response.json({ data: properties });
    }

    // STAFF: only properties they have explicit access to
    const access = await prisma.userPropertyAccess.findMany({
      where: { userId: session.user.id },
      select: { propertyId: true },
    });
    const propertyIds = access.map((a) => a.propertyId);

    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { venues: true } } },
    });
    return Response.json({ data: properties });
  } catch {
    return Response.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAdmin(session.user.role as string)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;
    let slug = slugify(name);

    const existing = await prisma.property.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const property = await prisma.property.create({
      data: { name, description, slug },
      include: { _count: { select: { venues: true } } },
    });

    return Response.json({ data: property }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create property" }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allergens = await prisma.allergen.findMany({
      orderBy: { name: "asc" },
    });
    return Response.json({ data: allergens });
  } catch {
    return Response.json({ error: "Failed to fetch allergens" }, { status: 500 });
  }
}

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
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

    const allergen = await prisma.allergen.create({ data: parsed.data });
    return Response.json({ data: allergen }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create allergen" }, { status: 500 });
  }
}

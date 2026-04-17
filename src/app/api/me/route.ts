import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        propertyAccess: { select: { propertyId: true, permissions: true } },
        venueAccess: { select: { venueId: true, permissions: true } },
        menuAccess: { select: { menuId: true, permissions: true } },
      },
    });

    if (!user) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: user });
  } catch {
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

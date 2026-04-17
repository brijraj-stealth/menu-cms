import { PrismaClient, UserRole, Permission } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Admin@123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@menucms.com" },
    update: {},
    create: {
      email: "admin@menucms.com",
      name: "Super Admin",
      password,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const property = await prisma.property.upsert({
    where: { slug: "demo-property" },
    update: {},
    create: {
      name: "Demo Property",
      slug: "demo-property",
      description: "A sample property to get started",
    },
  });

  const venue = await prisma.venue.upsert({
    where: { id: "demo-venue-id" },
    update: {},
    create: {
      id: "demo-venue-id",
      name: "Main Venue",
      propertyId: property.id,
    },
  });

  await prisma.userPropertyAccess.upsert({
    where: { userId_propertyId: { userId: admin.id, propertyId: property.id } },
    update: {},
    create: {
      userId: admin.id,
      propertyId: property.id,
      permissions: [Permission.VIEW, Permission.ADD, Permission.EDIT, Permission.DELETE],
    },
  });

  // Seed common allergens
  const allergens = [
    { name: "Gluten", icon: "🌾" },
    { name: "Dairy", icon: "🥛" },
    { name: "Eggs", icon: "🥚" },
    { name: "Nuts", icon: "🥜" },
    { name: "Soy", icon: "🫘" },
    { name: "Fish", icon: "🐟" },
    { name: "Shellfish", icon: "🦐" },
    { name: "Sesame", icon: "🌱" },
    { name: "Celery", icon: "🥬" },
    { name: "Mustard", icon: "🌭" },
    { name: "Sulphites", icon: "🍷" },
    { name: "Lupin", icon: "🌸" },
    { name: "Molluscs", icon: "🦑" },
  ];

  for (const allergen of allergens) {
    await prisma.allergen.upsert({
      where: { name: allergen.name },
      update: {},
      create: allergen,
    });
  }

  console.log("✅ Seed complete");
  console.log("📧 Admin email:    admin@menucms.com");
  console.log("🔑 Admin password: Admin@123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

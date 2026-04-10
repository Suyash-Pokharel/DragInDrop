import { getPrisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function createAdmin() {
  const prisma = getPrisma();

  const adminEmail = process.env.ADMIN_EMAIL || "admin@dragindrop.dev";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "Admin User";

  try {
    // Check if admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      // Update existing user to admin
      const updatedUser = await prisma.user.update({
        where: { email: adminEmail },
        data: {
          role: "ADMIN",
          emailVerified: new Date(),
          password: await bcrypt.hash(adminPassword, 12),
          name: adminName,
        },
      });

      console.log("✅ Existing user promoted to admin:");
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Role: ${updatedUser.role}`);
    } else {
      // Create new admin user
      const newAdmin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 12),
          name: adminName,
          role: "ADMIN",
          emailVerified: new Date(),
        },
      });

      console.log("✅ New admin user created:");
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
    }

    console.log("\n🔐 Admin Credentials:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log("\n⚠️  IMPORTANT: Change the password after first login!");
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

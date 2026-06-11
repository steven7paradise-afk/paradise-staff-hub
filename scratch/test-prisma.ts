import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

async function main() {
  console.log("Attempting to create a user with mansione...");
  try {
    const user = await prisma.user.create({
      data: {
        name: "Test User 2",
        email: "testuser2@example.com",
        password_hash: await bcrypt.hash("Paradise-123456!", 12),
        pin_hash: await bcrypt.hash("123456", 12),
        pin_lookup: "test_lookup_pin_987",
        role: UserRole.DIPENDENTE,
        sede_id: null,
        birth_date: null,
        fiscal_code: null,
        contract_start: null,
        contract_end: null,
        photo_url: null,
        whatsapp_phone: null,
        mansione: "Videomaker",
        active: true,
      },
    });
    console.log("Success! Created user:", user);
    
    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Cleaned up test user successfully.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branding = await prisma.brandingSetting.findFirst();
  if (branding) {
    console.log("Current branding settings:", branding);
    await prisma.brandingSetting.update({
      where: { id: branding.id },
      data: { logo_url: null },
    });
    console.log("Branding logo URL updated to null successfully.");
  } else {
    console.log("No branding setting found.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

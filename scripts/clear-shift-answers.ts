import "dotenv/config";
import { prisma } from "../lib/prisma";
import { SHIFT_RESPONSIBLE_ANSWERS_KEY } from "../lib/shift-responsible-questions";
import { SHIFT_RESPONSIBLE_ACCESS_KEY } from "../lib/shift-responsible-access";

async function main() {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  console.log(`Processing date: ${day}`);

  // Fetch current answers
  const answersSetting = await prisma.setting.findUnique({
    where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY },
  });

  const accessSetting = await prisma.setting.findUnique({
    where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY },
  });

  let answersObj: Record<string, any> = (answersSetting?.value as Record<string, any>) || {};
  let accessObj: Record<string, any> = (accessSetting?.value as Record<string, any>) || {};

  console.log("Current answers dates in DB:", Object.keys(answersObj));
  console.log(`Answers for today (${day}):`, answersObj[day] || "None");

  // Remove today's answers and reset today's access
  delete answersObj[day];
  delete accessObj[day];

  await prisma.setting.upsert({
    where: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY },
    create: { key: SHIFT_RESPONSIBLE_ANSWERS_KEY, value: answersObj },
    update: { value: answersObj },
  });

  await prisma.setting.upsert({
    where: { key: SHIFT_RESPONSIBLE_ACCESS_KEY },
    create: { key: SHIFT_RESPONSIBLE_ACCESS_KEY, value: accessObj },
    update: { value: accessObj },
  });

  console.log(`Successfully cleared compiled shift data for ${day}!`);
}

main()
  .catch((e) => {
    console.error("Error clearing shift answers:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

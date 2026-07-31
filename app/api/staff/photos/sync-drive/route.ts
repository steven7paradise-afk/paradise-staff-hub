import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findStaffPhotoInGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const workers = await prisma.user.findMany({
    where: {
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      active: true,
      employee_status: { not: "Ex dipendente" },
    },
    select: { id: true, name: true, photo_url: true },
    orderBy: { name: "asc" },
  });

  const updated: Array<{ id: string; photoUrl: string }> = [];
  const skipped: string[] = [];

  for (const worker of workers) {
    if (worker.photo_url) {
      continue;
    }

    try {
      const photo = await findStaffPhotoInGoogleDrive(worker.name);
      if (!photo?.photoUrl) {
        skipped.push(worker.name);
        continue;
      }

      await prisma.user.update({
        where: { id: worker.id },
        data: { photo_url: photo.photoUrl },
      });
      updated.push({ id: worker.id, photoUrl: photo.photoUrl });
    } catch (error) {
      skipped.push(worker.name);
      console.error(`Failed to sync Drive staff photo for ${worker.name}:`, error);
    }
  }

  return NextResponse.json({
    updated,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    skipped,
  });
}

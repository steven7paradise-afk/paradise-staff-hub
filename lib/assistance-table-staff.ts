import type { Prisma } from "@prisma/client";

// The owner also performs salon services while assigned to the office.
export const previousApplicationStaffWhere: Prisma.UserWhereInput = {
  active: true,
  OR: [
    { role: { in: ["DIPENDENTE", "RESPONSABILE"] }, location: { name: { contains: "buenos", mode: "insensitive" } } },
    { id: "cmqf02qgq0001jx0913ddfys1" },
  ],
};

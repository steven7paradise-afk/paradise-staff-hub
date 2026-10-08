// Share the existing application connection pool; do not open a second pool per feature.
export { prisma as chatDB } from "@/lib/prisma";

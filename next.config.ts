import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "googleapis"],
  turbopack: {},
};

export default nextConfig;

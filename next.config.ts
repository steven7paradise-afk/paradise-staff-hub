import type { NextConfig } from "next";

const nextConfig: any = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "googleapis"],
  webpack: (config: any) => {
    config.cache = false;
    return config;
  },
  turbopack: {},
};

export default nextConfig;

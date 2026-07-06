import type { NextConfig } from "next";

const nextConfig: any = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  webpack: (config: any) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;

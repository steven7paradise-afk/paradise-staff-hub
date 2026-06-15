import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;

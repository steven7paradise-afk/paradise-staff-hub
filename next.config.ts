import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "googleapis"],
  experimental: {
    cpus: 1,
    workerThreads: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    webpackMemoryOptimizations: true,
  },
  turbopack: {},
  webpack(config, { dev }) {
    if (!dev) config.cache = false;
    return config;
  },
};

export default nextConfig;

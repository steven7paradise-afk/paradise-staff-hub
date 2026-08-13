import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "googleapis"],
  // The Docker runner already copies production node_modules in full. Avoid
  // making Next walk the very large generated Google API package again while
  // collecting deployment traces (googleapis is ~200 MB / thousands of files).
  outputFileTracingExcludes: {
    "*": ["node_modules/googleapis/**/*", "node_modules/@googleapis/**/*"],
  },
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

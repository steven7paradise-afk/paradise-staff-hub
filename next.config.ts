import type { NextConfig } from "next";

const appBuildVersion = process.env.DEPLOY_ID || process.env.COMMIT_REF || `local-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "googleapis"],
  env: {
    NEXT_PUBLIC_APP_BUILD_VERSION: appBuildVersion,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/app-version",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/admin-assistant",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        ],
      },
    ];
  },
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

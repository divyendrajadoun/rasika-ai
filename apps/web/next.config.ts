import type { NextConfig } from "next";

// One .env at the repo root serves web, worker and drizzle-kit (Next only reads apps/web/.env).
try {
  process.loadEnvFile("../../.env");
} catch {
  /* CI / Vercel: env comes from the platform */
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@rasika/schema", "@rasika/engine"],
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["postgres", "ioredis"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/demo/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

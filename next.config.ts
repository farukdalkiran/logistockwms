import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development bundler scoped to this repository, not the parent
  // Windows user folder when another package-lock.json exists there.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

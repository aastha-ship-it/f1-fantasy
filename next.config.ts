import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project. A stray
  // pnpm-lock.yaml in the parent (~/Documents) makes Next infer the wrong
  // root and resolve `tailwindcss` from a non-existent node_modules.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

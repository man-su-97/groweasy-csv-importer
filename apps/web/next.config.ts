import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the production Docker image small — it bundles
  // only the traced dependencies a request needs, not the full node_modules.
  output: "standalone",
};

export default nextConfig;

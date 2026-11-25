import type { NextConfig } from "next";
import { generateReservedRoutes } from "./scripts/baepo-routes";

generateReservedRoutes();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/legacy/english.html", destination: "/english", permanent: true }];
  },
};

export default nextConfig;

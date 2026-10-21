import type { NextConfig } from "next";
import { generateReservedRoutes } from "./scripts/baepo-routes";

generateReservedRoutes();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

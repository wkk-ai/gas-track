import type { NextConfig } from "next";

const base = process.env.NODE_ENV === "production" ? "/gas-track" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: base,
  assetPrefix: base ? `${base}/` : "",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: base, NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID || "dev" },
};

export default nextConfig;

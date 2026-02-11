import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Pera",
  assetPrefix: "/Pera",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

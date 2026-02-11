import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Pera",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // basePath: "/Pera", // Commented out for custom domain root deployment
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

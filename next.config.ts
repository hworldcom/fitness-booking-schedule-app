import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 85, 95],
    deviceSizes: [640, 750, 828, 960, 1080, 1200, 1440, 1920, 2048, 2880, 3840],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    // Reduce memory usage during build
    workerThreads: false,
    cpus: 1,
    // Enable instrumentation for environment validation at startup
    instrumentationHook: true,
  },
};

export default nextConfig;

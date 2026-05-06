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
  },
  // Optimize for Vercel Free Tier (Hobby Plan)
  // Fluid Compute gives us 300 seconds (5 minutes) by default
  // No need to set maxDuration explicitly - it's automatic with Fluid Compute
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: true,
      },
      {
        source: "/favicon.png",
        destination: "/icon",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

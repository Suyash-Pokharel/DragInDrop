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
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon',
        permanent: true,
      },
      {
        source: '/favicon.png',
        destination: '/icon',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

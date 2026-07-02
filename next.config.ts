import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Cloud Run container image.
  output: "standalone",
  images: {
    // Profile photos are served directly from public Cloud Storage objects.
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;

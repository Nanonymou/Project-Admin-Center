import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Include the Drizzle migration SQL files in the /api/setup serverless bundle so
  // the one-shot DB setup endpoint can read and apply them at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/setup": ["./drizzle/**/*"],
  },
};

export default nextConfig;

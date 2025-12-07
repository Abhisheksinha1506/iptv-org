import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ISR is configured per-route using revalidate exports
  // See src/app/page.tsx and src/app/api/channels/route.ts
};

export default nextConfig;

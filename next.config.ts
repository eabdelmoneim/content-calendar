import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The device has too little memory for next build's own type check, so a
  // build on it sets CC_SKIP_BUILD_TYPECHECK=1 after `npx tsc --noEmit` passes.
  typescript: { ignoreBuildErrors: process.env.CC_SKIP_BUILD_TYPECHECK === "1" },
};

export default nextConfig;

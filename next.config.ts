import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: let devices on the tailnet (e.g. the iPad) load dev assets when
  // browsing the dev server via the machine's Tailscale IP. No effect in prod.
  allowedDevOrigins: ["100.74.49.85"],

  // node-ical pulls in temporal-polyfill (BigInt-heavy) which crashes when
  // Next.js bundles it. Keep it as a real Node.js require at runtime instead.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: let devices on the tailnet (e.g. the iPad) load dev assets when
  // browsing the dev server via the machine's Tailscale IP. No effect in prod.
  allowedDevOrigins: [
    "100.74.49.85",
    "personal.tailc2e1d7.ts.net",
    // Kloset moved to :8443 (tailscale serve 443 belongs to another project);
    // the Host header carries the port, so the bare hostname doesn't match.
    "personal.tailc2e1d7.ts.net:8443",
  ],

  // node-ical pulls in temporal-polyfill (BigInt-heavy) which crashes when
  // Next.js bundles it. Keep it as a real Node.js require at runtime instead.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;

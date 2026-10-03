import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

// Test mode (`npm run dev:test`, never a production build): Clerk is swapped for dummy users chosen at /dev/login,
// and the server keeps its files in .next-test so it can run beside the normal dev server. See lib/dev/.
const testLogin = process.env.NODE_ENV !== "production" && process.env.MEDIKARYA_TEST_LOGIN === "1";

/** @type {import('next').NextConfig} */const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  ...(testLogin && {
    distDir: ".next-test",
    turbopack: {
      resolveAlias: {
        "@clerk/nextjs": "./lib/dev/clerk-client-stub.tsx",
        "@clerk/nextjs/server": "./lib/dev/clerk-server-stub.ts",
      },
    },
  }),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "medikarya.jiobase.com",
      },
    ],
  },
  // The early contributors are now a section of the contributors page; old links and search results land there.
  async redirects() {
    return [{ source: "/early-contributors", destination: "/contributors#early", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);

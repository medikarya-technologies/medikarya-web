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
  // The page for colleges lived at /api-docs, a name that told neither people nor search engines what was on it.
  async redirects() {
    return [
      { source: "/early-contributors", destination: "/contributors#early", permanent: true },
      { source: "/api-docs", destination: "/colleges", permanent: true },
    ];
  },
  // Plain Markdown copies of public pages (lib/seo/markdown.ts) sit next to the page they copy: /blog/x.md beside
  // /blog/x. Checked before the app's own routes, so /blog/[slug] never sees "x.md" as a slug.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/blog/:slug.md", destination: "/md/blog/:slug" },
        { source: "/case-studies.md", destination: "/md/case-studies" },
        { source: "/case-studies/:id.md", destination: "/md/case-studies/:id" },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // JSON from the API is never a search result. robots.txt lets Google fetch the free case's data so it can
      // render /try; this keeps that response (and any other) out of the index.
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);

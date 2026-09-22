import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  async redirects() {
    return [
      {
        // One canonical host. Quote links travel inside WhatsApp messages, so
        // the apex wins on length: quickoffer.co.il/q/a8Hd3k.
        // Kept here rather than in the Vercel dashboard so it is versioned and
        // survives a project being re-created.
        source: "/:path*",
        has: [{ type: "host", value: "www.quickoffer.co.il" }],
        destination: "https://quickoffer.co.il/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

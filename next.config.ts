import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  async redirects() {
    return [
      {
        source: "/favorites",
        destination: "/timeline?tab=loved",
        permanent: false,
      },
      {
        source: "/favorite/new",
        destination: "/seeds/explore?mode=experience",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The postal index is read from disk at runtime — make sure the file is
  // traced into the serverless bundles that need it.
  outputFileTracingIncludes: {
    "/search": ["./data/postal_coords.json"],
    "/api/geocode": ["./data/postal_coords.json"],
  },
};

export default nextConfig;

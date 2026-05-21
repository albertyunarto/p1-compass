import type { MetadataRoute } from "next";
import sectorData from "@/data/postal_sectors.json";

const BASE = "https://p1compass.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, priority: 1 },
    { url: `${BASE}/about`, lastModified: now, priority: 0.5 },
  ];

  // One representative postal code per sector for long-tail SEO.
  const searches: MetadataRoute.Sitemap = Object.keys(sectorData).map(
    (sector) => ({
      url: `${BASE}/search?postal=${sector}0101`,
      lastModified: now,
      priority: 0.7,
    }),
  );

  return [...staticPages, ...searches];
}

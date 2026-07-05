// Single source of truth for site-level metadata used across the root layout,
// the generated OG image, and per-route metadata.
export const siteConfig = {
  name: "FeedMe",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://meefeed.vercel.app",
  title: "FeedMe — Visual feedback for product teams",
  tagline: "Visual feedback for product teams",
  description:
    "FeedMe turns messy visual feedback from live websites into organized, assignable, developer-ready reports inside a secure workspace.",
  ogDescription:
    "Turn website feedback into organized, assignable, developer-ready reports.",
  keywords: [
    "visual feedback",
    "website feedback",
    "bug reporting",
    "screenshot feedback",
    "QA",
    "product feedback",
    "issue tracking",
    "browser extension",
  ],
} as const

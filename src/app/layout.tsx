import type { Metadata, Viewport } from "next";
import { Google_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Agentation } from "agentation";
import { AppQueryProvider } from "@/components/providers/app-query-provider";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "productivity",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.ogDescription,
    url: siteConfig.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.ogDescription,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0F1012",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", googleSans.variable, geistSans.variable, geistMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppQueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AppQueryProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}

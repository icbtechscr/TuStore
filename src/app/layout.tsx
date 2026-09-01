import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SiteChromeGate } from "@/components/SiteChromeGate";
import { ChatWidget } from "@/components/ChatWidget";
import { CartProvider } from "@/lib/cart";
import { getNavMenu } from "@/lib/category-tree";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_OG_IMAGE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Tecnología y seguridad`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "tecnología Costa Rica",
    "cámaras de seguridad",
    "computadoras",
    "redes",
    "hogar",
    "POS",
    "Dahua",
    "Hikvision",
    "Uniview",
    SITE_NAME,
  ],
  openGraph: {
    type: "website",
    locale: "es_CR",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Tecnología y seguridad`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Tecnología y seguridad`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Tecnología y seguridad`,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/tustore-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/tustore-favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/tustore-apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b2e54",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const menu = await getNavMenu();
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <meta property="og:site_name" content={SITE_NAME} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(document.cookie.includes("site-theme=dark")){document.documentElement.classList.add("dark")}}catch(e){}',
          }}
        />
      </head>
      <body className="relative min-h-full flex flex-col text-ink-900">
        <CartProvider>
          <SiteChromeGate>
            <Header menu={menu} />
          </SiteChromeGate>
          <main className="flex-1">{children}</main>
          <SiteChromeGate>
            <Footer />
          </SiteChromeGate>
          <SiteChromeGate>
            <ChatWidget />
          </SiteChromeGate>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
// Asistente virtual (ChatWidget) montado arriba vía SiteChromeGate.

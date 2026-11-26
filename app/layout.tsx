import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/company";
import "./globals.css";
import "./bdg-theme.css";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Acheteur public`,
  description: "Votre espace acheteur public pour calculer votre remise et demander vos documents.",
  robots: { index: false, follow: false },
  icons: {
    icon: { url: "/images/bdg-logo.webp", type: "image/webp" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

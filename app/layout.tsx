import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devgri AI — Visual node canvas with BYOK and token masking",
  description:
    "Build visual 2D node workflows with an Auto-CMS layer. Bring your own API keys — they never leave your browser. PII and token masking built in.",
  openGraph: {
    title: "Devgri AI",
    description:
      "Visual node canvas + Auto-CMS. BYOK: your keys never leave your browser.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}

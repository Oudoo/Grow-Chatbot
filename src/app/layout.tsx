import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "grow-bot — Arabic-first Conversational AI",
  description:
    "Multi-provider, Arabic-first conversational AI platform: bilingual RTL admin, channel-ready API, and an embeddable web chat widget.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Arabic-first defaults; the dashboard's LanguageProvider updates dir/lang
  // client-side when the user toggles language.
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

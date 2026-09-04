import type { Metadata } from "next";
import { Geist_Mono, Libre_Franklin } from "next/font/google";
import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/styles/themes/default.css";
import { WebAwesomeRegistry } from "@/lib/webawesome-elements";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kitty — agent-native group orders",
  description: "Everyone's own AI agent adds their items to one shared group order.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`wa-dark ${libreFranklin.variable} ${geistMono.variable}`}>
      <body>
        <WebAwesomeRegistry />
        {children}
      </body>
    </html>
  );
}

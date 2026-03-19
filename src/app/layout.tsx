import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  display: "swap"
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Avalon Night",
  description: "The ancient game of loyalty and deception. Host a secret council, reveal hidden roles, unmask the traitors."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${garamond.variable} h-full`}
    >
      <body className="min-h-full bg-[#07090d] text-[#e8dcc8] antialiased">
        {children}
      </body>
    </html>
  );
}

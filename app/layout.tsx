import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnoopSmoke Monitor",
  description:
    "A vendor-neutral smoke and environmental event dashboard for the SnoopSmoke research prototype.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

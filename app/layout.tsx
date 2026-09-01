import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAY Engine — Armenian-first AI",
  description: "Armenian-first language, voice and creator intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}

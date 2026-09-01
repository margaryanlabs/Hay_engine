import type { Metadata } from "next";
import "./globals.css";
import "./creator.css";

export const metadata: Metadata = {
  title: "HAY Engine — Armenian-first AI Creator",
  description: "Create scripts, Armenian voice, captions, scene plans and vertical AI content with an Armenian-first language engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}

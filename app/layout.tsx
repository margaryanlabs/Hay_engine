import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./creator.css";
import "./marketing.css";
import "./login.css";

export const metadata: Metadata = {
  title: "HAY Engine — Armenian AI Marketing & Creator OS",
  description: "Armenian-first AI infrastructure for business intelligence, natural Armenian marketing, content creation, voice, captions and social publishing automation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}

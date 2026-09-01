import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./landing-v2.css";
import "./landing-v2-wow.css";
import "./creator.css";
import "./marketing.css";
import "./marketing-v2.css";
import "./competitor-intel.css";
import "./studio-status.css";
import "./studio-command.css";
import "./studio-onboarding.css";
import "./studio-decisions.css";
import "./voice-lab.css";
import "./quality.css";
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

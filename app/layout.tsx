import type { Metadata } from "next";
import "./globals.css";
import "./landing-v4.css";
import "./creator.css";
import "./marketing.css";
import "./marketing-v2.css";
import "./competitor-intel.css";
import "./studio-status.css";
import "./studio-commercial.css";
import "./studio-command.css";
import "./studio-onboarding.css";
import "./studio-decisions.css";
import "./studio-today.css";
import "./studio-calendar.css";
import "./studio-policy.css";
import "./studio-memory.css";
import "./studio-workspace.css";
import "./studio-series.css";
import "./studio-campaign.css";
import "./studio-campaign-analytics.css";
import "./studio-experiment-runner.css";
import "./studio-conversion.css";
import "./voice-lab.css";
import "./language-lab.css";
import "./native-benchmark.css";
import "./developer.css";
import "./pronunciation-console.css";
import "./correction-lab.css";
import "./correction-consent.css";
import "./quality.css";
import "./login.css";

export const metadata: Metadata = {
  title: "HAY Engine — Armenian-First AI Marketing OS",
  description: "An Armenian-first AI marketing operating system for business intelligence, strategy, natural Armenian content, voice, publishing, experimentation and first-party attribution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}

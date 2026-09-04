import type { Metadata } from "next";
import "./globals.css";
import "./landing-v5.css";
import "./landing-v6.css";
import "./creator.css";
import "./marketing.css";
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
import "./product-ui.css";
import "./product-ui-legacy.css";
import "./redesign-v7.css";
import "./redesign-v7-labs.css";

export const metadata: Metadata = {
  title: "HAY — Armenian-first Marketing OS",
  description: "HAY understands the business, plans the next move, creates Armenian-first content, publishes with approval and learns from outcomes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body className="hay-ui">{children}</body>
    </html>
  );
}

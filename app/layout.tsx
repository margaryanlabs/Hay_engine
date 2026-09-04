import type { Metadata } from "next";
import "./globals.css";
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
import "./landing-v7.css";

export const metadata: Metadata = {
  title: "HAY — Marketing OS built for Armenia",
  description: "HAY keeps brand context, plans the next move, creates Armenian-first content, manages approval and publishing, and learns from outcomes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body className="hay-ui">{children}</body>
    </html>
  );
}

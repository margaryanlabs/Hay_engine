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
import "./employee.css";
import "./employee-inbox.css";
import "./employee-subscription.css";
import "./native-benchmark.css";
import "./developer.css";
import "./pronunciation-console.css";
import "./correction-lab.css";
import "./correction-consent.css";
import "./quality.css";
import "./login.css";
import "./product-ui.css";
import "./product-ui-legacy.css";

export const metadata: Metadata = {
  title: "HAY Engine — AI Marketing Autopilot for Armenia",
  description: "Connect your business once. HAY plans, creates and operates Armenian-first marketing with content, voice, publishing, memory and outcome learning.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}

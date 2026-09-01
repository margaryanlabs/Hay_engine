import { NextResponse } from "next/server";
import { runArmenianQualityBenchmark } from "@/lib/hay/quality-suite";

export const dynamic = "force-dynamic";

export async function GET(){
  const report=runArmenianQualityBenchmark();
  return NextResponse.json({
    ...report,
    generatedAt:new Date().toISOString(),
  });
}

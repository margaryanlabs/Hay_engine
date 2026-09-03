import { NextResponse } from "next/server";
import { captionsFromAlignment } from "@/lib/creator/alignment";
import { buildCaptionCues } from "@/lib/creator/captions";
import type { CaptionCue } from "@/lib/creator/types";
import type { ElevenLabsAlignment } from "@/lib/providers/elevenlabs";

export const runtime = "nodejs";

function timestamp(seconds: number, separator: "," | ".") {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}${separator}${String(millis).padStart(3,"0")}`;
}

function toSrt(cues: CaptionCue[]) {
  return cues.map((cue,index)=>`${index+1}\n${timestamp(cue.start,",")} --> ${timestamp(cue.end,",")}\n${cue.text}`).join("\n\n");
}

function toVtt(cues: CaptionCue[]) {
  return `WEBVTT\n\n${cues.map(cue=>`${timestamp(cue.start,".")} --> ${timestamp(cue.end,".")}\n${cue.text}`).join("\n\n")}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  const duration = Math.min(3600, Math.max(0.5, Number(body.duration) || 15));
  const wordsPerCue = Math.min(8, Math.max(2, Number(body.wordsPerCue) || 4));
  const alignment = body.alignment && typeof body.alignment === "object" ? body.alignment as ElevenLabsAlignment : null;

  const aligned = alignment ? captionsFromAlignment(alignment) : [];
  const cues = aligned.length ? aligned : text ? buildCaptionCues(text,duration,wordsPerCue) : [];
  if (!cues.length) return NextResponse.json({ error: "text_or_alignment_required" }, { status: 400 });

  return NextResponse.json({
    source: aligned.length ? "alignment" : "estimated",
    duration,
    cueCount: cues.length,
    cues,
    srt: toSrt(cues),
    vtt: toVtt(cues),
  });
}

import type { CaptionCue } from "./types";
import type { ElevenLabsAlignment } from "@/lib/providers/elevenlabs";

export function buildAlignedCaptionCues(alignment: ElevenLabsAlignment | null, wordsPerCue = 4): CaptionCue[] | null {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!chars?.length || !starts?.length || !ends?.length || chars.length !== starts.length || chars.length !== ends.length) return null;

  const text = chars.join("");
  const spans: Array<{ startIndex: number; endIndex: number }> = [];
  const regex = /\S+/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) spans.push({ startIndex: match.index, endIndex: match.index + match[0].length });
  if (!spans.length) return null;

  const cues: CaptionCue[] = [];
  for (let cursor = 0; cursor < spans.length; cursor += wordsPerCue) {
    const group = spans.slice(cursor, cursor + wordsPerCue);
    const first = group[0];
    const last = group[group.length - 1];
    const cueText = text.slice(first.startIndex, last.endIndex).trim();
    const start = Number(starts[first.startIndex]?.toFixed(3));
    const endIndex = Math.max(first.startIndex, last.endIndex - 1);
    const end = Number(ends[endIndex]?.toFixed(3));
    if (!cueText || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    cues.push({ id: `a${cues.length + 1}`, start, end, text: cueText });
  }
  return cues.length ? cues : null;
}

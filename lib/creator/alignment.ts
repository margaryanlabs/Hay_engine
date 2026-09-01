import type { CaptionCue } from "./types";
import type { ElevenLabsAlignment } from "@/lib/providers/elevenlabs";

export function captionsFromAlignment(alignment: ElevenLabsAlignment | null): CaptionCue[] {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!chars?.length || !starts?.length || !ends?.length || chars.length !== starts.length || chars.length !== ends.length) return [];

  const words: Array<{ text: string; start: number; end: number }> = [];
  let buffer = "";
  let wordStart = 0;
  let wordEnd = 0;

  function flush() {
    const text = buffer.trim();
    if (text) words.push({ text, start: wordStart, end: wordEnd });
    buffer = "";
  }

  chars.forEach((char, index) => {
    if (/\s/.test(char)) { flush(); return; }
    if (!buffer) wordStart = starts[index] ?? 0;
    buffer += char;
    wordEnd = ends[index] ?? starts[index] ?? wordStart;
    if (/[.!?։…,:;]$/.test(char)) flush();
  });
  flush();

  const cues: CaptionCue[] = [];
  let group: typeof words = [];
  for (const word of words) {
    group.push(word);
    const joined = group.map((item) => item.text).join(" ");
    const shouldFlush = group.length >= 5 || joined.length >= 42 || /[.!?։…]$/.test(word.text);
    if (shouldFlush) {
      cues.push({ id: `cap-${cues.length + 1}`, start: group[0].start, end: group[group.length - 1].end, text: joined });
      group = [];
    }
  }
  if (group.length) cues.push({ id: `cap-${cues.length + 1}`, start: group[0].start, end: group[group.length - 1].end, text: group.map((item) => item.text).join(" ") });
  return cues;
}

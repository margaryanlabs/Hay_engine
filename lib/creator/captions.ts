import type { CaptionCue } from "./types";

const punctuation = /[,.!?։՝՜՞:;]+$/u;

export function buildCaptionCues(text: string, duration: number, wordsPerCue = 4): CaptionCue[] {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (!words.length || duration <= 0) return [];

  const groups: string[][] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (current.length >= wordsPerCue || punctuation.test(word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  const totalWeight = groups.reduce((sum, group) => sum + group.join(" ").length, 0) || 1;
  let cursor = 0;

  return groups.map((group, index) => {
    const textValue = group.join(" ");
    const weight = textValue.length / totalWeight;
    const cueDuration = index === groups.length - 1 ? duration - cursor : Math.max(0.45, duration * weight);
    const start = Number(cursor.toFixed(3));
    const end = Number(Math.min(duration, cursor + cueDuration).toFixed(3));
    cursor = end;
    return { id: `c${index + 1}`, start, end, text: textValue };
  });
}

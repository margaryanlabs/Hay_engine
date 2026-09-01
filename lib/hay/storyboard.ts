import type { ContentStyle, Locale, Storyboard } from "./types";
import { normalizeForSpeech } from "./normalize";

const copy = {
  hy: {
    title: "HAY Engine ստեղծագործական պլան",
    hook: "Գաղափարից՝ պատրաստի բովանդակություն։ Բնական հայերենով։",
    bridge: "HAY Engine-ը հասկանում է հայկական լեզվական միջավայրը, ճիշտ արտասանությունը և խառը հայերեն-անգլերեն խոսքը։",
    proof: "Սցենար, ձայն, ենթագրեր և տեսարանների կառուցվածք՝ մեկ հոսքում։",
    cta: "Ստեղծիր հայերեն։ Հնչիր բնական։",
  },
  en: {
    title: "HAY Engine creative plan",
    hook: "From idea to finished content. Naturally Armenian.",
    bridge: "HAY Engine understands Armenian language context, pronunciation and real-world code switching.",
    proof: "Script, voice, captions and scene structure in one workflow.",
    cta: "Create Armenian. Sound natural.",
  },
  ru: {
    title: "Креативный план HAY Engine",
    hook: "От идеи до готового контента. Естественно по-армянски.",
    bridge: "HAY Engine понимает армянский контекст, произношение и живое смешение языков.",
    proof: "Сценарий, голос, субтитры и сцены в одном потоке.",
    cta: "Создавай на армянском. Звучи естественно.",
  },
} as const;

export function buildDemoStoryboard(prompt: string, language: Locale, duration = 15, _style: ContentStyle = "advertising"): Storyboard {
  const t = copy[language];
  const subject = prompt.trim().slice(0, 90) || t.hook;
  const voiceover = `${t.hook} ${subject}. ${t.bridge} ${t.proof} ${t.cta}`;
  const normalized = normalizeForSpeech(voiceover, language);
  const slice = duration / 5;

  return {
    title: t.title,
    language,
    duration,
    hook: t.hook,
    voiceover: normalized.spokenText,
    cta: t.cta,
    generatedBy: "hay-demo",
    scenes: [
      { id: "s1", start: 0, end: slice, visual: "Dark premium opening, Armenian typography, fast visual hook", screenText: t.hook, voiceover: t.hook },
      { id: "s2", start: slice, end: slice * 2, visual: "Subject-specific cinematic footage or generated visual", screenText: subject, voiceover: subject },
      { id: "s3", start: slice * 2, end: slice * 3, visual: "Language intelligence layers: pronunciation, context, code-switch", screenText: "LANGUAGE → VOICE → CAPTIONS", voiceover: t.bridge },
      { id: "s4", start: slice * 3, end: slice * 4, visual: "Creator pipeline assembles scenes and synchronized subtitles", screenText: "SCRIPT · VOICE · VIDEO", voiceover: t.proof },
      { id: "s5", start: slice * 4, end: duration, visual: "HAY Engine brand reveal with clean CTA", screenText: t.cta, voiceover: t.cta },
    ],
  };
}

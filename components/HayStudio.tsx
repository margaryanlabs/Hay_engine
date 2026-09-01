"use client";

import { useMemo, useState } from "react";
import type { ContentStyle, Dialect, Locale, NormalizationResult, Storyboard } from "@/lib/hay/types";

const ui = {
  hy: {
    eyebrow: "ARMENIAN-FIRST AI INFRASTRUCTURE",
    titleA: "Ստեղծիր ամեն ինչ։",
    titleB: "Բնական հայերենով։",
    sub: "HAY Engine-ը միավորում է լեզուն, արտասանությունը, ձայնը, ենթագրերը և տեսանյութի կառուցվածքը մեկ հայկական AI շերտում։",
    prompt: "Ի՞նչ ես ուզում ստեղծել։",
    placeholder: "Օրինակ՝ ստեղծիր 15 վայրկյանանոց պրեմիում գովազդ Երևանի նոր ռեստորանի համար…",
    generate: "Ստեղծել պլանը",
    normalize: "Փորձարկել HAY լեզվական շարժիչը",
    output: "Արդյունք",
    scenes: "Տեսարաններ",
    voice: "Ստեղծել հայկական ձայն",
    dialect: "Բարբառ",
    eastern: "Արևելահայերեն",
    western: "Արևմտահայերեն",
    style: "Ոճ",
    duration: "Տևողություն",
    language: "Բովանդակության լեզու",
    engine: "Շարժիչ",
    demo: "Demo fallback",
    ai: "OpenAI",
    spoken: "Ինչպես կարտասանվի",
    detected: "HAY Engine-ի ուղղումներ",
  },
  en: {
    eyebrow: "ARMENIAN-FIRST AI INFRASTRUCTURE",
    titleA: "Create anything.",
    titleB: "Naturally Armenian.",
    sub: "HAY Engine unifies language, pronunciation, voice, captions and video structure in one Armenian-first AI layer.",
    prompt: "What do you want to create?",
    placeholder: "Example: create a 15-second premium ad for a new restaurant in Yerevan…",
    generate: "Generate plan",
    normalize: "Test HAY language engine",
    output: "Output",
    scenes: "Scenes",
    voice: "Generate Armenian voice",
    dialect: "Dialect",
    eastern: "Eastern Armenian",
    western: "Western Armenian",
    style: "Style",
    duration: "Duration",
    language: "Content language",
    engine: "Engine",
    demo: "Demo fallback",
    ai: "OpenAI",
    spoken: "Speech rendering",
    detected: "HAY Engine corrections",
  },
  ru: {
    eyebrow: "ARMENIAN-FIRST AI INFRASTRUCTURE",
    titleA: "Создавай что угодно.",
    titleB: "Естественно по-армянски.",
    sub: "HAY Engine объединяет язык, произношение, голос, субтитры и структуру видео в одном Armenian-first AI-слое.",
    prompt: "Что хочешь создать?",
    placeholder: "Например: создай 15-секундную премиальную рекламу нового ресторана в Ереване…",
    generate: "Создать план",
    normalize: "Проверить HAY language engine",
    output: "Результат",
    scenes: "Сцены",
    voice: "Создать армянский голос",
    dialect: "Диалект",
    eastern: "Восточноармянский",
    western: "Западноармянский",
    style: "Стиль",
    duration: "Длительность",
    language: "Язык контента",
    engine: "Движок",
    demo: "Demo fallback",
    ai: "OpenAI",
    spoken: "Как будет произнесено",
    detected: "Исправления HAY Engine",
  },
} as const;

const styles: Array<{ value: ContentStyle; label: string }> = [
  { value: "advertising", label: "Advertising" },
  { value: "social", label: "Social" },
  { value: "business", label: "Business" },
  { value: "news", label: "News" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
];

export default function HayStudio() {
  const [uiLocale, setUiLocale] = useState<Locale>("hy");
  const [language, setLanguage] = useState<Locale>("hy");
  const [dialect, setDialect] = useState<Dialect>("eastern");
  const [style, setStyle] = useState<ContentStyle>("advertising");
  const [duration, setDuration] = useState(15);
  const [prompt, setPrompt] = useState("Ստեղծիր 15 վայրկյանանոց գովազդ հայկական AI հարթակի համար։ BTC-ն $110K ա, բայց funding rate-ը բարձր ա։");
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [normalization, setNormalization] = useState<NormalizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const t = ui[uiLocale];

  const canSubmit = useMemo(() => prompt.trim().length > 3 && !busy, [prompt, busy]);

  async function createStoryboard() {
    if (!canSubmit) return;
    setBusy(true);
    setVoiceMessage(null);
    try {
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language, dialect, style, duration }),
      });
      setStoryboard(await response.json());
    } finally {
      setBusy(false);
    }
  }

  async function testNormalizer() {
    setBusy(true);
    try {
      const response = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, locale: language, dialect }),
      });
      setNormalization(await response.json());
    } finally {
      setBusy(false);
    }
  }

  async function createVoice() {
    const source = storyboard?.voiceover || normalization?.spokenText || prompt;
    setBusy(true);
    setVoiceMessage(null);
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source, dialect }),
      });
      const data = await response.json();
      if (!data.configured) {
        setVoiceMessage(data.message);
        setNormalization(data.normalized);
      } else {
        setVoiceUrl(`data:${data.contentType};base64,${data.audioBase64}`);
        setNormalization(data.normalized);
      }
    } catch {
      setVoiceMessage("Voice generation failed. Check provider configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span className="brandMark">Հ</span><span>HAY <b>ENGINE</b></span></div>
        <div className="localeSwitch">
          {(["hy", "en", "ru"] as Locale[]).map((locale) => (
            <button key={locale} className={uiLocale === locale ? "active" : ""} onClick={() => setUiLocale(locale)}>
              {locale === "hy" ? "ՀԱՅ" : locale.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">{t.eyebrow}</div>
        <h1>{t.titleA}<br/><span>{t.titleB}</span></h1>
        <p>{t.sub}</p>
        <div className="statusRow">
          <span><i className="dot"/> Armenian priority</span>
          <span>HY / EN / RU</span>
          <span>Language → Voice → Video</span>
        </div>
      </section>

      <section className="studioGrid">
        <div className="composer card">
          <label>{t.prompt}</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t.placeholder}/>

          <div className="settings">
            <label>{t.language}
              <select value={language} onChange={(e) => setLanguage(e.target.value as Locale)}>
                <option value="hy">Հայերեն</option><option value="en">English</option><option value="ru">Русский</option>
              </select>
            </label>
            <label>{t.dialect}
              <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} disabled={language !== "hy"}>
                <option value="eastern">{t.eastern}</option><option value="western">{t.western}</option>
              </select>
            </label>
            <label>{t.style}
              <select value={style} onChange={(e) => setStyle(e.target.value as ContentStyle)}>
                {styles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>{t.duration}
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={10}>10 sec</option><option value={15}>15 sec</option><option value={30}>30 sec</option><option value={45}>45 sec</option>
              </select>
            </label>
          </div>

          <div className="actions">
            <button className="primary" disabled={!canSubmit} onClick={createStoryboard}>{busy ? "…" : t.generate}</button>
            <button className="secondary" disabled={!canSubmit} onClick={testNormalizer}>{t.normalize}</button>
          </div>
        </div>

        <aside className="card engineCard">
          <div className="cardHeader"><span>HAY LANGUAGE CORE</span><span className="live">ACTIVE</span></div>
          <div className="metric"><strong>Հայերեն</strong><small>Primary language</small></div>
          <div className="metric"><strong>Eastern + Western</strong><small>Dialect-aware contract</small></div>
          <div className="metric"><strong>Code-switch</strong><small>Հայերեն + EN + RU + brands</small></div>
          <div className="metric"><strong>TTS-safe</strong><small>Display text ≠ spoken text</small></div>
        </aside>
      </section>

      {normalization && (
        <section className="result card">
          <div className="sectionTitle"><span>01</span><h2>{t.spoken}</h2></div>
          <div className="spoken">{normalization.spokenText}</div>
          <div className="chips">
            {normalization.issues.length ? normalization.issues.map((issue, index) => (
              <span key={`${issue.source}-${index}`}>{issue.source} → {issue.spoken}</span>
            )) : <span>No pronunciation transforms needed</span>}
          </div>
        </section>
      )}

      {storyboard && (
        <section className="result card">
          <div className="sectionTitle"><span>02</span><h2>{t.output}</h2><em>{t.engine}: {storyboard.generatedBy === "openai" ? t.ai : t.demo}</em></div>
          <h3 className="hook">{storyboard.hook}</h3>
          <p className="voiceover">{storyboard.voiceover}</p>
          <div className="sceneList">
            {storyboard.scenes.map((scene, index) => (
              <article className="scene" key={scene.id}>
                <div className="sceneTime">{scene.start.toFixed(0)}–{scene.end.toFixed(0)}s</div>
                <div><small>SCENE {String(index + 1).padStart(2, "0")}</small><h4>{scene.screenText}</h4><p>{scene.visual}</p></div>
              </article>
            ))}
          </div>
          <div className="voiceArea">
            <button className="primary" onClick={createVoice} disabled={busy}>{t.voice}</button>
            {voiceUrl && <audio controls src={voiceUrl}/>} 
            {voiceMessage && <p className="providerMessage">{voiceMessage}</p>}
          </div>
        </section>
      )}

      <footer><span>HAY ENGINE / 2026</span><span>ARMENIAN LANGUAGE × CREATOR INTELLIGENCE</span></footer>
    </main>
  );
}

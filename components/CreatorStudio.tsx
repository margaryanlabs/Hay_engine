"use client";

import { useMemo, useState } from "react";
import ReelPreview from "./ReelPreview";
import type { CreatorProject } from "@/lib/creator/types";
import type { ContentStyle, Dialect, Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    eyebrow: "ARMENIAN-FIRST CREATOR ENGINE",
    title: "Գաղափարից՝ պատրաստի Reel։",
    sub: "HAY Engine-ը միացնում է սցենարը, բնական հայերենը, ձայնը, ենթագրերը, տեսարանները և տպագրությունը մեկ ստեղծագործական հոսքում։",
    prompt: "Ի՞նչ ես ուզում ստեղծել։",
    placeholder: "Օրինակ՝ ստեղծիր 15 վայրկյանանոց պրեմիում գովազդ հայկական գինու բրենդի համար…",
    generate: "Ստեղծել Reel նախագիծը",
    generating: "Ստեղծվում է…",
    project: "Creator նախագիծ",
    scenes: "Տեսարաններ",
    voice: "Ստեղծել ձայն",
    visual: "Ստեղծել տեսարան",
    noKey: "Provider-ը դեռ միացված չէ։ Demo pipeline-ը շարունակում է աշխատել։",
  },
  en: {
    eyebrow: "ARMENIAN-FIRST CREATOR ENGINE",
    title: "From idea to a renderable Reel.",
    sub: "HAY Engine connects script, natural Armenian, voice, captions, scenes and typography into one creator workflow.",
    prompt: "What do you want to create?",
    placeholder: "Example: create a 15-second premium ad for an Armenian wine brand…",
    generate: "Create Reel project",
    generating: "Creating…",
    project: "Creator project",
    scenes: "Scenes",
    voice: "Generate voice",
    visual: "Generate visual",
    noKey: "Provider is not configured yet. The demo pipeline still works.",
  },
  ru: {
    eyebrow: "ARMENIAN-FIRST CREATOR ENGINE",
    title: "От идеи до готового Reel-проекта.",
    sub: "HAY Engine связывает сценарий, естественный армянский, голос, субтитры, сцены и типографику в один creator-процесс.",
    prompt: "Что хочешь создать?",
    placeholder: "Например: создай 15-секундную премиальную рекламу армянского винного бренда…",
    generate: "Создать Reel-проект",
    generating: "Создаю…",
    project: "Creator-проект",
    scenes: "Сцены",
    voice: "Создать голос",
    visual: "Создать визуал",
    noKey: "Провайдер пока не настроен. Demo pipeline продолжает работать.",
  },
} as const;

const styleOptions: ContentStyle[] = ["advertising", "social", "business", "news", "formal", "casual"];

export default function CreatorStudio() {
  const [uiLocale, setUiLocale] = useState<Locale>("hy");
  const [language, setLanguage] = useState<Locale>("hy");
  const [dialect, setDialect] = useState<Dialect>("eastern");
  const [style, setStyle] = useState<ContentStyle>("advertising");
  const [duration, setDuration] = useState(15);
  const [prompt, setPrompt] = useState("Ստեղծիր 15 վայրկյանանոց պրեմիում գովազդ HAY Engine-ի համար։ Ցույց տուր, որ AI-ն վերջապես բնական հայերեն է խոսում։");
  const [project, setProject] = useState<CreatorProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | undefined>();
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const t = copy[uiLocale];

  const selectedScene = useMemo(
    () => project?.scenes.find((scene) => scene.id === selectedSceneId) ?? project?.scenes[0],
    [project, selectedSceneId],
  );

  async function generateProject() {
    if (prompt.trim().length < 4 || busy) return;
    setBusy(true);
    setMessage(null);
    setSceneImages({});
    setVoiceUrl(null);
    try {
      const response = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language, dialect, style, duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "creator_generation_failed");
      setProject(data);
      setSelectedSceneId(data.scenes?.[0]?.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Creator generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateVisual(sceneId: string) {
    const scene = project?.scenes.find((item) => item.id === sceneId);
    if (!scene || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scene.asset.prompt }),
      });
      const data = await response.json();
      if (!data.configured) {
        setMessage(t.noKey);
        return;
      }
      if (!response.ok) throw new Error(data.error || "image_generation_failed");
      const source = data.b64 ? `data:${data.contentType};base64,${data.b64}` : data.url;
      if (source) setSceneImages((current) => ({ ...current, [sceneId]: source }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateVoice() {
    if (!project || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: project.voice.text, dialect: project.dialect }),
      });
      const data = await response.json();
      if (!data.configured) {
        setMessage(data.message || t.noKey);
        return;
      }
      if (!response.ok) throw new Error(data.error || "voice_generation_failed");
      setVoiceUrl(`data:${data.contentType};base64,${data.audioBase64}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Voice generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell creatorShell">
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

      <section className="creatorHero">
        <div className="eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </section>

      <section className="creatorWorkspace">
        <div className="creatorComposer card">
          <label>{t.prompt}</label>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t.placeholder} />
          <div className="settings creatorSettings">
            <label>Language
              <select value={language} onChange={(event) => setLanguage(event.target.value as Locale)}>
                <option value="hy">Հայերեն</option><option value="en">English</option><option value="ru">Русский</option>
              </select>
            </label>
            <label>Dialect
              <select value={dialect} disabled={language !== "hy"} onChange={(event) => setDialect(event.target.value as Dialect)}>
                <option value="eastern">Արևելահայերեն</option><option value="western">Արևմտահայերեն</option>
              </select>
            </label>
            <label>Style
              <select value={style} onChange={(event) => setStyle(event.target.value as ContentStyle)}>
                {styleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Duration
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                <option value={10}>10 sec</option><option value={15}>15 sec</option><option value={30}>30 sec</option><option value={45}>45 sec</option>
              </select>
            </label>
          </div>
          <button className="primary creatorGenerate" disabled={busy || prompt.trim().length < 4} onClick={generateProject}>
            {busy ? t.generating : t.generate}
          </button>
          {message && <div className="creatorMessage">{message}</div>}
        </div>

        <aside className="creatorPipeline card">
          <div className="cardHeader"><span>PIPELINE</span><span className="live">{project ? "READY" : "IDLE"}</span></div>
          {[
            ["01", "HAY Language Core", "normalize · pronunciation · code-switch"],
            ["02", "Creative Planner", project?.providers.planner || "demo / OpenAI"],
            ["03", "Asset Director", "image · video · stock · motion"],
            ["04", "Voice + Captions", project?.providers.voice || "ElevenLabs adapter"],
            ["05", "Render Manifest", "1080 × 1920 · 30fps"],
          ].map(([num, title, meta]) => (
            <div className="pipelineRow" key={num}><span>{num}</span><div><strong>{title}</strong><small>{meta}</small></div></div>
          ))}
        </aside>
      </section>

      {project && (
        <section className="creatorResult">
          <div className="creatorPreviewCard card">
            <div className="sectionTitle"><span>01</span><h2>LIVE REEL PREVIEW</h2><em>{project.id}</em></div>
            <ReelPreview project={project} sceneImages={sceneImages} selectedSceneId={selectedSceneId} onSelectScene={setSelectedSceneId} />
          </div>

          <div className="creatorInspector card">
            <div className="sectionTitle"><span>02</span><h2>{t.project}</h2><em>{project.status}</em></div>
            <h3 className="creatorHook">{project.storyboard.hook}</h3>
            <p className="creatorVoiceText">{project.speech.spokenText}</p>
            <div className="creatorActions">
              <button className="primary" onClick={generateVoice} disabled={busy}>{t.voice}</button>
              {selectedScene && <button className="secondary" onClick={() => generateVisual(selectedScene.id)} disabled={busy}>{t.visual}</button>}
            </div>
            {voiceUrl && <audio className="creatorAudio" controls src={voiceUrl} />}

            <div className="sceneInspector">
              <div className="sceneInspectorHead"><span>{t.scenes}</span><span>{project.scenes.length}</span></div>
              {project.scenes.map((scene, index) => (
                <button key={scene.id} className={selectedScene?.id === scene.id ? "active" : ""} onClick={() => setSelectedSceneId(scene.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{scene.screenText}</strong><small>{scene.asset.kind} · {scene.start.toFixed(0)}–{scene.end.toFixed(0)}s</small></div>
                </button>
              ))}
            </div>

            {selectedScene && (
              <div className="assetPrompt">
                <span>ASSET PROMPT / TEXT GENERATED SEPARATELY</span>
                <p>{selectedScene.asset.prompt}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <footer><span>HAY ENGINE / 2026</span><span>CREATE ANYTHING. NATURALLY ARMENIAN.</span></footer>
    </main>
  );
}

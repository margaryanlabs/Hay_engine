"use client";

import { useEffect, useMemo, useState } from "react";
import type { CreatorProject } from "@/lib/creator/types";

export default function ReelPreview({
  project,
  sceneImages,
  selectedSceneId,
  onSelectScene,
}: {
  project: CreatorProject;
  sceneImages: Record<string, string>;
  selectedSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now() - time * 1000;
    let frame = 0;
    const tick = (now: number) => {
      const next = (now - startedAt) / 1000;
      if (next >= project.duration) {
        setTime(0);
        setPlaying(false);
        return;
      }
      setTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Playback origin is intentionally captured only when play/duration changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, project.duration]);

  const activeScene = useMemo(() => {
    if (selectedSceneId && !playing) {
      return project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0];
    }
    return project.scenes.find((scene) => time >= scene.start && time < scene.end) ?? project.scenes.at(-1)!;
  }, [project.scenes, selectedSceneId, playing, time]);

  const manualImage = sceneImages[activeScene.id];
  const stock = activeScene.asset.stock;
  const stockVideo = !manualImage && stock?.mediaType === "video" ? stock.url : null;
  const image = manualImage || (stock?.mediaType === "image" ? stock.url : stockVideo ? stock?.previewUrl || undefined : undefined);
  const activeCaption = project.captions.find((cue) => time >= cue.start && time < cue.end);

  return (
    <div className="reelPreviewWrap">
      <div
        className={`reelPreview scene-${project.scenes.findIndex((scene) => scene.id === activeScene.id) % 5}`}
        style={!stockVideo && image ? { backgroundImage: `linear-gradient(180deg, rgba(4,6,8,.08), rgba(4,6,8,.72)), url(${image})` } : undefined}
      >
        {stockVideo ? <video key={`${activeScene.id}:${stockVideo}`} src={stockVideo} poster={stock?.previewUrl || undefined} muted autoPlay loop playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.82}}/> : null}
        {stockVideo ? <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(4,6,8,.08), rgba(4,6,8,.72))"}}/> : null}
        <div className="previewTop"><span>HAY / CREATOR</span><span>{project.format}</span></div>
        <div className="previewCenter">
          <div className="previewKicker">{activeScene.asset.kind.replace("-", " ").toUpperCase()}</div>
          <h3>{activeScene.screenText}</h3>
          {!image && !stockVideo && <p>{activeScene.visual}</p>}
        </div>
        <div className="previewBottom">
          <div className="captionMock">{activeCaption?.text || activeScene.voiceover}</div>
          <div className="previewProgress"><i style={{ width: `${Math.min(100, (time / project.duration) * 100)}%` }} /></div>
        </div>
      </div>

      <div className="previewControls">
        <button onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play preview"}</button>
        <span>{time.toFixed(1)} / {project.duration}s</span>
      </div>

      {stock ? <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:10,fontSize:10,color:"#7f878d"}}>
        <a href={stock.sourcePage} target="_blank" rel="noreferrer" style={{color:"#a77762",textDecoration:"none"}}>{stock.attribution}</a>
        <span>·</span>
        <a href={stock.providerUrl} target="_blank" rel="noreferrer" style={{color:"#8398a5",textDecoration:"none"}}>Media provided by Pexels</a>
      </div> : null}

      <div className="miniTimeline">
        {project.scenes.map((scene) => (
          <button
            key={scene.id}
            className={scene.id === activeScene.id ? "active" : ""}
            style={{ flex: scene.end - scene.start }}
            onClick={() => {
              setPlaying(false);
              setTime(scene.start);
              onSelectScene?.(scene.id);
            }}
            title={scene.screenText}
          />
        ))}
      </div>
    </div>
  );
}
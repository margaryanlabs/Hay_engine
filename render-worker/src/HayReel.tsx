import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import type { RenderInput, RenderScene } from "./types";

const fontStack = '"Noto Sans Armenian", "DejaVu Sans", Arial, sans-serif';
const accent = "#d9ff63";

const gradients = [
  "radial-gradient(circle at 70% 18%, rgba(217,255,99,.18), transparent 28%), linear-gradient(145deg,#15191b,#080a0b 62%)",
  "radial-gradient(circle at 18% 30%, rgba(75,120,180,.28), transparent 32%), linear-gradient(155deg,#10161e,#08090a 62%)",
  "radial-gradient(circle at 74% 66%, rgba(125,88,173,.26), transparent 30%), linear-gradient(155deg,#17111c,#09090b 62%)",
  "radial-gradient(circle at 25% 75%, rgba(172,124,70,.27), transparent 32%), linear-gradient(155deg,#19140e,#090a0b 62%)",
  "radial-gradient(circle at 50% 32%, rgba(217,255,99,.2), transparent 27%), linear-gradient(155deg,#121811,#080a09 62%)",
];

function SceneLayer({ scene, image, index }: { scene: RenderScene; image?: string; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.max(1, fps * 0.22)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, Math.max(1, fps * 0.55)], [42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imageScale = interpolate(frame, [0, Math.max(1, fps * 4)], [1.05, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: gradients[index % gradients.length], overflow: "hidden" }}>
      {image ? (
        <Img
          src={image}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.72,
            scale: imageScale,
          }}
        />
      ) : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,6,8,.05), rgba(4,6,8,.76))" }} />
      <div style={{ position: "absolute", top: 76, left: 68, right: 68, display: "flex", justifyContent: "space-between", fontFamily: fontStack, fontSize: 19, letterSpacing: 3.5, color: "rgba(255,255,255,.62)" }}>
        <span>HAY / CREATOR</span><span>{scene.asset.kind.toUpperCase()}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 68,
          right: 68,
          top: "35%",
          opacity,
          translate: `0 ${translateY}px`,
        }}
      >
        <div style={{ color: accent, fontFamily: fontStack, fontSize: 18, letterSpacing: 4, textTransform: "uppercase", marginBottom: 24 }}>
          NATURALLY ARMENIAN
        </div>
        <div style={{ fontFamily: fontStack, fontSize: 76, fontWeight: 600, lineHeight: 1.06, letterSpacing: -3, color: "#f5f6f7", textWrap: "balance" }}>
          {scene.screenText}
        </div>
        {!image ? <div style={{ fontFamily: fontStack, fontSize: 25, lineHeight: 1.55, color: "#92999f", marginTop: 28, maxWidth: 820 }}>{scene.visual}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

function CaptionLayer({ captions }: { captions: RenderInput["project"]["captions"] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const cue = captions.find((item) => time >= item.start && time < item.end);
  if (!cue) return null;

  return (
    <div style={{ position: "absolute", left: 80, right: 80, bottom: 118, display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: fontStack, fontSize: 34, lineHeight: 1.35, fontWeight: 500, color: "white", background: "rgba(0,0,0,.48)", border: "1px solid rgba(255,255,255,.1)", padding: "18px 24px", borderRadius: 20, textAlign: "center", maxWidth: 900 }}>
        {cue.text}
      </div>
    </div>
  );
}

export const HayReel: React.FC<RenderInput> = ({ project, sceneImages = {}, audioSrc }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#080a0b" }}>
      {project.scenes.map((scene, index) => {
        const from = Math.max(0, Math.round(scene.start * fps));
        const durationInFrames = Math.max(1, Math.round((scene.end - scene.start) * fps));
        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
            <SceneLayer scene={scene} image={sceneImages[scene.id]} index={index} />
          </Sequence>
        );
      })}
      <CaptionLayer captions={project.captions} />
      {audioSrc ? <Audio src={audioSrc} /> : null}
    </AbsoluteFill>
  );
};

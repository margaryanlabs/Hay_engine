import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import type { RenderInput, RenderScene } from "./types";

const fontStack = '"Noto Sans Armenian", "DejaVu Sans", Arial, sans-serif';
const accent = "#b27a62";

const gradients = [
  "radial-gradient(circle at 70% 18%, rgba(178,122,98,.20), transparent 28%), linear-gradient(145deg,#171516,#080a0b 62%)",
  "radial-gradient(circle at 18% 30%, rgba(112,139,157,.24), transparent 32%), linear-gradient(155deg,#10161c,#08090a 62%)",
  "radial-gradient(circle at 74% 66%, rgba(139,111,99,.20), transparent 30%), linear-gradient(155deg,#171315,#09090b 62%)",
  "radial-gradient(circle at 25% 75%, rgba(166,119,86,.22), transparent 32%), linear-gradient(155deg,#18140f,#090a0b 62%)",
  "radial-gradient(circle at 50% 32%, rgba(105,132,149,.22), transparent 27%), linear-gradient(155deg,#11171a,#080a0a 62%)",
];

function SceneLayer({ scene, image, video, index }: { scene: RenderScene; image?: string; video?: string; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.max(1, fps * 0.22)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, Math.max(1, fps * 0.55)], [42, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [0, Math.max(1, fps * 4)], [1.05, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: gradients[index % gradients.length], overflow: "hidden" }}>
      {video ? <OffthreadVideo src={video} muted style={{ position:"absolute", width:"100%", height:"100%", objectFit:"cover", opacity:0.78 }} /> : null}
      {!video && image ? <Img src={image} style={{ position:"absolute", width:"100%", height:"100%", objectFit:"cover", opacity:0.72, scale:imageScale }} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,6,8,.05), rgba(4,6,8,.76))" }} />
      <div style={{ position:"absolute", top:76, left:68, right:68, display:"flex", justifyContent:"space-between", fontFamily:fontStack, fontSize:19, letterSpacing:3.5, color:"rgba(255,255,255,.62)" }}>
        <span>HAY / CREATOR</span><span>{scene.asset.kind.toUpperCase()}</span>
      </div>
      <div style={{ position:"absolute", left:68, right:68, top:"35%", opacity, translate:`0 ${translateY}px` }}>
        <div style={{ color:accent, fontFamily:fontStack, fontSize:18, letterSpacing:4, textTransform:"uppercase", marginBottom:24 }}>NATURALLY ARMENIAN</div>
        <div style={{ fontFamily:fontStack, fontSize:76, fontWeight:600, lineHeight:1.06, letterSpacing:-3, color:"#f5f1ed", textWrap:"balance" }}>{scene.screenText}</div>
        {!image && !video ? <div style={{ fontFamily:fontStack, fontSize:25, lineHeight:1.55, color:"#92999f", marginTop:28, maxWidth:820 }}>{scene.visual}</div> : null}
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
  return <div style={{ position:"absolute", left:80, right:80, bottom:118, display:"flex", justifyContent:"center" }}><div style={{ fontFamily:fontStack, fontSize:34, lineHeight:1.35, fontWeight:500, color:"white", background:"rgba(0,0,0,.48)", border:"1px solid rgba(255,255,255,.1)", padding:"18px 24px", borderRadius:20, textAlign:"center", maxWidth:900 }}>{cue.text}</div></div>;
}

export const HayReel: React.FC<RenderInput> = ({ project, sceneImages = {}, sceneVideos = {}, audioSrc }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor:"#080a0b" }}>
      {project.scenes.map((scene,index) => {
        const from = Math.max(0,Math.round(scene.start*fps));
        const durationInFrames = Math.max(1,Math.round((scene.end-scene.start)*fps));
        return <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}><SceneLayer scene={scene} image={sceneImages[scene.id]} video={sceneVideos[scene.id]} index={index}/></Sequence>;
      })}
      <CaptionLayer captions={project.captions}/>
      {audioSrc ? <Audio src={audioSrc}/> : null}
    </AbsoluteFill>
  );
};
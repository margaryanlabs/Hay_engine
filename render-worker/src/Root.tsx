import React from "react";
import { Composition } from "remotion";
import { HayReel } from "./HayReel";
import type { RenderInput } from "./types";
import sampleInput from "../sample-input.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="HAY-Reel"
      component={HayReel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={450}
      defaultProps={sampleInput as RenderInput}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.project.duration * 30)),
        width: props.project.width || 1080,
        height: props.project.height || 1920,
        fps: props.project.fps || 30,
      })}
    />
  );
};

# HAY Creator Engine

The Creator Engine turns one brief into a renderable vertical-video project.

```text
prompt
  ↓
storyboard
  ↓
HAY speech normalization
  ↓
scene asset direction
  ├─ motion / brand
  ├─ OpenAI generated image
  ├─ Google Veo generated video
  └─ Pexels resolved stock video/photo
  ↓
Armenian typography overlays + caption cues
  ↓
voice provider
  ↓
Remotion render worker
```

## Core rule: do not ask image/video models to typeset Armenian

Generated media prompts explicitly request **no text / no letters / no captions**. Armenian copy is rendered later by HAY Engine with real fonts and layout controls. This prevents hallucinated Armenian glyphs and keeps spelling deterministic.

## Stock media

When the Asset Director marks a scene as `stock` and `PEXELS_API_KEY` is configured, HAY resolves a bounded number of scenes automatically. It requests portrait media, prefers a video long enough for the scene, and falls back to a portrait photo when no suitable video is available.

The resolved `CreatorProject` preserves the Pexels source page, creator name/link and explicit attribution text. Preview surfaces the credit and Pexels link, while render dispatch derives `sceneVideos` / `sceneImages` directly from the saved project. User-generated scene images override automatic stock media for that scene.

Pexels resolution is optional: missing credentials or a search miss leaves the original planned stock scene intact and never blocks Creator project generation.

## API

`POST /api/create`

Input:

```json
{
  "prompt": "Ստեղծիր 15 վայրկյանանոց գովազդ...",
  "language": "hy",
  "dialect": "eastern",
  "style": "advertising",
  "duration": 15
}
```

Output is a `CreatorProject` containing storyboard, speech representation, caption cues, asset prompts/resolved stock metadata, transitions, provider state and render manifest metadata.

`POST /api/image` generates a vertical scene visual when `OPENAI_API_KEY` is configured. Motion/typography scenes do not require an image model.

`POST /api/video` starts a Veo scene operation when configured.

`POST /api/render` dispatches the project to the dedicated Remotion worker. Resolved stock media is converted into render media maps server-side; browser overrides are layered on top.
# HAY Creator Engine

The Creator Engine turns one brief into a renderable vertical-video project.

```text
prompt
  ↓
storyboard
  ↓
HAY speech normalization
  ↓
scene asset plans + Armenian typography overlays
  ↓
caption cues
  ↓
voice provider
  ↓
render manifest
```

## Core rule: do not ask image/video models to typeset Armenian

Generated media prompts explicitly request **no text / no letters / no captions**. Armenian copy is rendered later by HAY Engine with real fonts and layout controls. This prevents hallucinated Armenian glyphs and keeps spelling deterministic.

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

Output is a `CreatorProject` containing storyboard, speech representation, caption cues, asset prompts, transitions, provider state and render manifest metadata.

`POST /api/image` generates a vertical scene visual when `OPENAI_API_KEY` is configured. Motion/typography scenes do not require an image model.

## Next render step

The manifest is intentionally renderer-agnostic at the API boundary. The planned production renderer is a dedicated Remotion worker rather than heavy rendering inside a short-lived request handler.

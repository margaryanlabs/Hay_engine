# HAY Engine architecture

## Product principle

Armenian is not a translation afterthought. The platform keeps separate representations for what the user writes, what appears on screen, and what a speech model should pronounce.

```text
User brief
   ↓
HAY Language Core
   ├─ normalization
   ├─ pronunciation dictionary
   ├─ code-switch handling
   ├─ Eastern / Western Armenian contract
   └─ display text vs spoken text
   ↓
Creative planner
   ├─ deterministic fallback
   └─ optional LLM provider
   ↓
Media providers
   ├─ TTS (ElevenLabs first)
   ├─ STT (adapter next)
   ├─ image generation (adapter next)
   └─ video generation (adapter next)
   ↓
Composition layer
   ├─ captions/timestamps
   ├─ typography
   ├─ scene timing
   └─ final render (Remotion planned)
```

## Why display and spoken text are separate

Example input:

`BTC-ն $110K ա, բայց funding rate-ը բարձր ա։`

Display can remain compact:

`BTC — $110K / FUNDING ↑`

Speech representation can become:

`Բիթքոյնը հարյուր տասը հազար դոլար ա, բայց ֆանդինգ ռեյթը բարձր ա։`

This split is one of the core HAY Engine primitives.

## API surface in MVP

- `POST /api/normalize` — convert text to a speech-safe representation
- `POST /api/storyboard` — create a Reel storyboard; uses OpenAI when configured and a deterministic fallback otherwise
- `POST /api/voice` — normalize Armenian text and generate ElevenLabs speech when configured

## Provider policy

Providers are replaceable. HAY Engine should own Armenian normalization, evaluation, corrections, user experience and datasets. Foundation models remain interchangeable compute layers.

## Data policy

Do not silently train on private user content. Any future correction/dataset collection flow must be explicit, consented and traceable by source/license.

# HAY Engine

**Create anything. Naturally Armenian.**

HAY Engine is an Armenian-first AI language and creator infrastructure project. Armenian is the priority language; English and Russian are first-class secondary interfaces/output languages.

## Current MVP

- Armenian / English / Russian web studio
- Armenian speech normalization
- display-text vs spoken-text separation
- brand/acronym pronunciation dictionary
- finance/code-switch normalization (`BTC`, `$110K`, `funding rate`, etc.)
- Eastern / Western Armenian architecture switch
- Reel storyboard generation
- deterministic fallback that works without paid APIs
- optional OpenAI creative planner
- optional ElevenLabs v3 Armenian speech generation with character timestamps

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app works without provider keys in demo mode.

## Optional providers

### OpenAI

Set `OPENAI_API_KEY` to enable AI-generated storyboards. The default model is configurable with `OPENAI_MODEL`.

### ElevenLabs

Set:

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_v3
```

The voice route first passes Armenian through the HAY normalization layer and then calls ElevenLabs speech-with-timestamps.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Dataset strategy

See [`docs/DATASET_SCHEMA.md`](docs/DATASET_SCHEMA.md). HAY Engine should only build proprietary datasets from licensed, curated, public-domain/compatible, or explicitly consented material with clear provenance.

## Philosophy

We do **not** need to train an Armenian Veo/Gemini from scratch. We use strong foundation models as interchangeable providers and build the missing Armenian-specific layer ourselves: language normalization, pronunciation, dialect handling, code-switching, subtitles, typography, evaluation and eventually targeted fine-tuned models.

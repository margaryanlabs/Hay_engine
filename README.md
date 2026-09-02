# HAY Engine

**Create anything. Naturally Armenian.**

HAY Engine is an Armenian-first AI language, creator and marketing operating system. Armenian is the priority language; English and Russian are first-class secondary interfaces/output languages.

## Current product layers

### HAY Creator
- Armenian / English / Russian Creator Studio
- one-request `prompt → CreatorProject` pipeline
- Armenian speech normalization with separate display/spoken forms
- brand/acronym/code-switch pronunciation dictionary
- Eastern / Western Armenian architecture switch
- Reel storyboard generation with deterministic fallback
- automatic caption cue generation
- scene asset direction (`generated-image`, `stock`, `motion`, `brand`)
- Armenian typography rendered separately from generated media
- live 9:16 Reel preview + scene timeline
- optional OpenAI creative planner and image generation
- optional ElevenLabs Armenian speech generation
- Veo provider contract and Remotion render worker

### HAY Marketing OS
- business and competitor intelligence
- 7–30 day content strategy and planning
- real approval inbox and performance memory
- Smart Calendar with Armenia-local baseline publishing windows
- Instagram / TikTok / YouTube connection and publish pipeline
- durable render and publish jobs
- per-channel publishing policy: `manual`, `approval`, `autoqueue`
- TikTok remains explicit-consent gated even when automation is enabled
- real metrics feed the next planning cycle; no synthetic performance numbers

## Why Armenian text is rendered separately

HAY Engine does not ask image/video models to draw Armenian words when we need exact copy. Media prompts request **no text / no letters / no captions**. HAY Engine overlays real Armenian typography afterwards, so spelling and glyphs stay deterministic.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app works without provider keys in demo mode.

## APIs

- `POST /api/create` — create a complete Reel project manifest
- `POST /api/normalize` — create speech-safe Armenian representation
- `POST /api/storyboard` — generate a storyboard
- `POST /api/voice` — generate Armenian voice when a speech provider is configured
- `POST /api/image` — generate a vertical scene visual when OpenAI is configured
- `GET /api/health` — inspect provider/runtime readiness
- `POST /api/marketing/plan` — create and persist a marketing plan
- `POST /api/marketing/autopilot` — create the HAY analyze→plan→create→approve→publish→learn run
- `GET/PATCH /api/social/connections` — inspect connections and publishing policies
- `POST /api/social/publish` — finalize or schedule a provider publish job
- `GET /api/studio/overview` — approvals, performance, calendar and operational state

## Dedicated Supabase setup

Use a **dedicated HAY project**. Do not mix HAY tables/tokens into unrelated products.

Apply SQL in this order:

1. `supabase/schema.sql`
2. `supabase/002_publish_settings_and_metrics.sql`
3. `supabase/003_publish_worker_state.sql`
4. `supabase/004_render_pipeline.sql`
5. `supabase/005_publishing_policies.sql`
6. `supabase/storage.sql`
7. `supabase/vault.sql`

`005_publishing_policies.sql` adds per-channel automation policy and prevents duplicate active publish jobs. Until it is applied, HAY keeps content approval working and degrades publishing-policy features safely.

## Optional providers

### OpenAI

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2
```

### ElevenLabs

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_v3
```

The voice route first passes Armenian through the HAY normalization layer and then calls the speech provider.

## Architecture

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CREATOR_ENGINE.md`](docs/CREATOR_ENGINE.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Dataset strategy

See [`docs/DATASET_SCHEMA.md`](docs/DATASET_SCHEMA.md). HAY Engine should only build proprietary datasets from licensed, curated, public-domain/compatible, or explicitly consented material with clear provenance.

## Philosophy

We do **not** need to train an Armenian Veo/Gemini from scratch. We use strong foundation models as interchangeable providers and build the missing Armenian-specific layer ourselves: language normalization, pronunciation, dialect handling, code-switching, subtitles, typography, evaluation and eventually targeted fine-tuned models.
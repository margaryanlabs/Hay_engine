# HAY Engine

**Create anything. Naturally Armenian.**

HAY Engine is an Armenian-first AI language, creator and marketing operating system. Armenian is the priority language; English and Russian are first-class secondary interfaces/output languages.

## Current product layers

### HAY Language API
- versioned Armenian pronunciation registry
- speech-safe normalization for commercial numbers, currencies, brands, suffixes and code-switching
- Armenian file transcription through a replaceable STT provider adapter
- HAY transcript correction with protected-value fail-safe
- standalone caption generation with structured cues, SRT and WebVTT
- HY / EN / RU translation with Armenian-first syntax and preservation of prices, URLs and Latin brand tokens
- interactive `/language` Language Lab for testing the whole pipeline
- provider-backed language routes are account-gated in production by default

### HAY Creator
- Armenian / English / Russian Creator Studio
- one-request `prompt → CreatorProject` pipeline
- Armenian speech normalization with separate display/spoken forms
- Armenian commercial number/currency handling (USD / AMD / EUR / GEL)
- brand/acronym/code-switch pronunciation dictionary with Armenian suffix handling
- Eastern / Western Armenian architecture switch
- Reel storyboard generation with deterministic fallback
- provider-aligned caption cue generation
- scene asset direction (`generated-image`, `stock`, `motion`, `brand`)
- Armenian typography rendered separately from generated media
- live 9:16 Reel preview + scene timeline
- optional OpenAI creative planner/image generation
- ElevenLabs/Azure Armenian speech provider layer
- Veo video provider + durable Remotion render worker

### HAY Marketing OS
- business and competitor intelligence
- 7–30 day content strategy and planning
- Campaign Brain, Content Series and anti-repetition Content Memory
- real approval inbox and performance memory
- Smart Calendar with Armenia-local baseline publishing windows
- Instagram / TikTok / YouTube / Facebook connection and publish pipeline
- durable render and publish jobs
- per-channel publishing policy: `manual`, `approval`, `autoqueue`
- controlled Experiment Runner and campaign analytics
- privacy-first first-party Conversion Bridge attribution
- secure multi-business workspaces
- real metrics feed the next planning cycle; no synthetic performance numbers

### HAY Commercial Core
- Free / Creator / Growth / Business entitlement model
- owner-scoped plan limits for brands and social channels
- append-only usage metering for content assets, AI video credits and Armenian voice minutes
- Studio plan/usage visibility
- provider-neutral hosted checkout contract
- trusted server-to-server entitlement sync endpoint
- production Studio auth gate
- safe rollout: limits stay disabled until migration + billing are explicitly enabled

## Why Armenian text is rendered separately

HAY Engine does not ask image/video models to draw Armenian words when exact copy matters. Media prompts request **no text / no letters / no captions**. HAY overlays real Armenian typography afterwards, so spelling and glyphs stay deterministic.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app works without provider keys in demo mode. Persistent Studio becomes authenticated when the dedicated HAY Supabase project is configured.

## Core APIs

### Language
- `POST /api/normalize` — create speech-safe Armenian representation
- `GET/POST /api/pronounce` — inspect the versioned pronunciation registry or pronounce arbitrary text
- `POST /api/transcribe` — transcribe an uploaded audio/video file and run Armenian transcript correction
- `POST /api/captions` — create caption cues plus SRT and WebVTT from text or provider alignment
- `POST /api/translate` — translate HY / EN / RU with protected-value preservation
- `POST /api/voice` — generate and meter Armenian voice when a provider is configured

### Creator / marketing / commercial
- `POST /api/create` — create a complete Reel project manifest
- `POST /api/storyboard` — generate a storyboard
- `POST /api/image` — generate a vertical scene visual when OpenAI is configured
- `POST /api/video` — start a metered Veo scene generation
- `GET /api/health` — inspect provider/runtime readiness
- `GET /api/setup/status` — inspect provider, language API, worker, social and commercial go-live readiness
- `POST /api/marketing/plan` — create, persist and meter a marketing plan
- `POST /api/marketing/autopilot` — create the HAY analyze→plan→create→approve→publish→learn run
- `GET/PATCH /api/social/connections` — inspect connections and publishing policies
- `POST /api/social/publish` — finalize or schedule a provider publish job
- `GET /api/studio/overview` — approvals, performance, calendar and operational state
- `GET /api/account/entitlement` — current plan, limits, usage and remaining allowance
- `POST /api/billing/checkout` — resolve a configured hosted checkout for a paid plan
- `POST /api/billing/sync` — trusted server-to-server entitlement update after verified payment events

## Dedicated Supabase setup

Use a **dedicated HAY project**. Do not mix HAY tables/tokens into unrelated products.

Apply SQL in this order:

1. `supabase/schema.sql`
2. `supabase/002_publish_settings_and_metrics.sql`
3. `supabase/003_publish_worker_state.sql`
4. `supabase/004_render_pipeline.sql`
5. `supabase/005_publishing_policies.sql`
6. `supabase/006_first_party_attribution.sql`
7. `supabase/storage.sql`
8. `supabase/vault.sql`
9. `supabase/007_commercial_core.sql`

Do not set `HAY_ENFORCE_PLANS=true` until migration 007 is applied and the billing sync path has been verified. Without enforcement, commercial diagnostics and usage visibility degrade safely instead of blocking the current product.

## Billing rollout

HAY does not hard-code one payment company. Configure HTTPS hosted checkout URLs in `HAY_CHECKOUT_*_URL`. Your payment-provider adapter must verify that provider's signed webhook first, then call `POST /api/billing/sync` using the server-only `HAY_BILLING_SYNC_SECRET`. The browser success redirect is never treated as proof of payment.

## Armenian quality

`npm run quality` is a release gate. It covers natural Eastern Armenian, Yerevan-casual transformations, business domains, code-switching, currencies, exact commercial values and brand/suffix pronunciation. `/quality` exposes the deterministic report.

Provider STT/translation output is not trusted blindly: HAY adds transcript/translation preservation checks around commercial values and code-switched brand tokens. Comparative model claims still require a blind native-speaker benchmark.

This is an internal regression system, not an independent claim that HAY is the world's best Armenian AI. Comparative claims should follow a blind native-speaker benchmark.

## Architecture

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CREATOR_ENGINE.md`](docs/CREATOR_ENGINE.md)
- [`docs/ARMENIAN_QUALITY.md`](docs/ARMENIAN_QUALITY.md)
- [`docs/MARKETING_OS.md`](docs/MARKETING_OS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/REVENUE_SPRINT.md`](docs/REVENUE_SPRINT.md)

## Dataset strategy

See [`docs/DATASET_SCHEMA.md`](docs/DATASET_SCHEMA.md). Proprietary datasets should only use licensed, curated, public-domain/compatible or explicitly consented material with clear provenance. Private customer content is not training data by default.

## Philosophy

We do **not** need to train an Armenian frontier model from scratch. HAY uses strong foundation models as interchangeable providers and owns the missing Armenian-specific layer around them: normalization, pronunciation, dialect handling, code-switching, typography, transcript correction, translation safeguards, evaluation, business context, workflow, outcome memory and eventually targeted fine-tuned components where measured benchmarks justify them.

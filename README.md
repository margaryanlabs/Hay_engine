# HAY Engine

**Create anything. Naturally Armenian.**

HAY Engine is an Armenian-first AI language, creator and marketing operating system. Armenian is the priority language; English and Russian are first-class secondary interfaces/output languages.

## Current product layers

### HAY Language API
- deterministic versioned Armenian pronunciation core
- persistent pronunciation registry with precedence `business → account → HAY-reviewed system → curated core`
- `/pronunciations` Dictionary Console for owner/business overrides, provenance and live testing
- `/corrections` Teach HAY workflow for private-by-default Armenian corrections and explicit reuse consent
- consent-aware correction review with separate product-improvement, benchmark and model-training permissions
- provenance-tracked general dataset registry with withdrawal and append-only audit history
- speech-safe normalization for commercial numbers, currencies, brands, suffixes and code-switching
- Armenian file transcription through a replaceable STT provider adapter
- HAY transcript correction with protected-value fail-safe
- standalone caption generation with structured cues, SRT and WebVTT
- HY / EN / RU translation with Armenian-first syntax and preservation of prices, URLs and Latin brand tokens
- interactive `/language` Language Lab for testing the whole pipeline
- provider-backed Studio language routes are account-gated in production by default

### HAY Developer Platform
- stable `/api/v1/language/*` developer surface
- revocable server-side credentials with `hay_live_` prefix
- raw developer keys are displayed once; only SHA-256 hashes are stored
- coarse `language` scope or endpoint-specific language scopes
- dedicated request / character / audio-byte usage ledger, separate from Studio subscriptions
- mandatory operator-configured per-key hourly request limit before the API becomes ready
- bounded developer text payloads (20k characters by default, configurable)
- owner console at `/developers` for key creation, revocation and current-month usage
- developer key tables are server-only: `anon` and normal `authenticated` Data API access is explicitly revoked
- API activation is an explicit production switch via `HAY_DEVELOPER_API_ENABLED=true`

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
- append-only Studio usage metering for content assets, AI video credits and Armenian voice minutes
- separate developer API usage ledger
- Studio plan/usage visibility
- provider-neutral hosted checkout contract
- trusted server-to-server entitlement sync endpoint
- production Studio auth gate
- safe rollout: limits and developer API stay disabled until migrations + production configuration are explicitly enabled

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

### Product language routes
- `POST /api/normalize` — create speech-safe Armenian representation using the active persistent pronunciation layer when available
- `GET/POST /api/pronounce` — inspect the curated core or pronounce arbitrary text through the active runtime registry
- `GET/POST/DELETE /api/pronunciations` — owner-scoped persistent pronunciation management
- `GET/POST/DELETE /api/language/corrections` — owner correction history, private/consented submission and withdrawal
- `GET/POST /api/language/corrections/review` — reviewer-only consented correction queue and decisions
- `POST /api/transcribe` — transcribe an uploaded audio/video file and run Armenian transcript correction
- `POST /api/captions` — create caption cues plus SRT and WebVTT from text or provider alignment
- `POST /api/translate` — translate HY / EN / RU with protected-value preservation
- `POST /api/voice` — generate and meter Armenian voice using the same active pronunciation registry

### Developer Language API V1
- `GET /api/v1/language` — machine-readable API manifest and safety limits
- `POST /api/v1/language/normalize`
- `POST /api/v1/language/pronounce`
- `POST /api/v1/language/captions`
- `POST /api/v1/language/translate`
- `POST /api/v1/language/transcribe` — multipart upload

Use `Authorization: Bearer hay_live_...` or `x-hay-api-key: hay_live_...` from a trusted backend. Never embed a HAY developer key in browser JavaScript, mobile bundles or a public repository. Keys are created/revoked from `/developers`; the raw secret is not recoverable after creation.

### Creator / marketing / commercial
- `POST /api/create` — create a complete Reel project manifest
- `POST /api/storyboard` — generate a storyboard
- `POST /api/image` — generate a vertical scene visual when OpenAI is configured
- `POST /api/video` — start a metered Veo scene generation
- `GET /api/health` — inspect provider/runtime readiness
- `GET /api/setup/status` — inspect provider, Language API/data, consent flywheel, developer API, worker, social and commercial go-live readiness
- `POST /api/marketing/plan` — create, persist and meter a marketing plan
- `POST /api/marketing/autopilot` — create the HAY analyze→plan→create→approve→publish→learn run
- `GET/PATCH /api/social/connections` — inspect connections and publishing policies
- `POST /api/social/publish` — finalize or schedule a provider publish job
- `GET /api/studio/overview` — approvals, performance, calendar and operational state
- `GET /api/account/entitlement` — current plan, limits, usage and remaining allowance
- `GET/POST/DELETE /api/developer/keys` — owner-scoped developer key management
- `GET /api/developer/usage` — owner-scoped current-month developer API usage
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
10. `supabase/008_language_registry.sql`
11. `supabase/009_language_corrections_and_dataset_registry.sql`

Migration 007 contains the commercial schema: entitlements, Studio usage, developer API keys and developer API usage. Developer credentials/usage are intentionally not available to `anon` or normal `authenticated` Data API clients; owner-facing routes authenticate the user first and then use the server-only admin client.

Migration 008 adds the persistent pronunciation registry and append-only audit snapshots. The in-code curated dictionary remains the fallback, so missing database state never turns HAY pronunciation into an empty registry. Private account/business pronunciation data is operational configuration and is not promoted into global system/training data by default.

Migration 009 adds consent-aware human corrections, correction audit snapshots, the general `dataset_records` provenance registry and dataset audit snapshots. Corrections are private-by-default: product-improvement consent is required before a correction can enter the reviewer queue or reviewed HAY data. Benchmark and model-training permissions are separate flags and cannot bypass that requirement. Withdrawal revokes linked dataset eligibility.

Configure reviewer access with server-only `HAY_LANGUAGE_REVIEWER_EMAILS`. Do not prefix it with `NEXT_PUBLIC_`.

Do not set `HAY_ENFORCE_PLANS=true` until migration 007 is applied and the billing sync path has been verified. Do not set `HAY_DEVELOPER_API_ENABLED=true` until the developer tables exist, a positive hourly request limit is configured, and the API has been smoke-tested with a revocable key.

## Billing rollout

HAY does not hard-code one payment company. Configure HTTPS hosted checkout URLs in `HAY_CHECKOUT_*_URL`. Your payment-provider adapter must verify that provider's signed webhook first, then call `POST /api/billing/sync` using the server-only `HAY_BILLING_SYNC_SECRET`. The browser success redirect is never treated as proof of payment.

## Armenian quality

`npm run quality` is a release gate. It covers natural Eastern Armenian, Yerevan-casual transformations, business domains, code-switching, currencies, exact commercial values, brand/suffix pronunciation, runtime pronunciation override behavior and correction-consent policy invariants. `/quality` exposes the deterministic language report.

Provider STT/translation output is not trusted blindly: HAY adds transcript/translation preservation checks around commercial values and code-switched brand tokens. `/benchmark` is the separate blinded native-speaker evidence layer.

Internal regression scores are not independent proof that HAY is the world's best Armenian AI. Comparative claims should only follow enough independent blind native-speaker reviews under the frozen benchmark protocol.

## Architecture

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CREATOR_ENGINE.md`](docs/CREATOR_ENGINE.md)
- [`docs/ARMENIAN_QUALITY.md`](docs/ARMENIAN_QUALITY.md)
- [`docs/PRONUNCIATION_REGISTRY.md`](docs/PRONUNCIATION_REGISTRY.md)
- [`docs/LANGUAGE_CORRECTIONS.md`](docs/LANGUAGE_CORRECTIONS.md)
- [`docs/MARKETING_OS.md`](docs/MARKETING_OS.md)
- [`docs/NATIVE_BENCHMARK.md`](docs/NATIVE_BENCHMARK.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/REVENUE_SPRINT.md`](docs/REVENUE_SPRINT.md)

## Dataset strategy

See [`docs/DATASET_SCHEMA.md`](docs/DATASET_SCHEMA.md) and [`docs/LANGUAGE_CORRECTIONS.md`](docs/LANGUAGE_CORRECTIONS.md). Proprietary datasets should only use licensed, curated, public-domain/compatible or explicitly consented material with clear provenance. Private customer content, private pronunciation overrides and no-consent corrections are not training data by default.

## Philosophy

We do **not** need to train an Armenian frontier model from scratch. HAY uses strong foundation models as interchangeable providers and owns the missing Armenian-specific layer around them: normalization, pronunciation, dialect handling, code-switching, consented human correction, provenance, proprietary reviewed language memory, typography, transcript correction, translation safeguards, evaluation, developer infrastructure, business context, workflow, outcome memory and eventually targeted fine-tuned components where measured benchmarks and eligible consented data justify them.

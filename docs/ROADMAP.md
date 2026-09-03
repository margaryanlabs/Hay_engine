# HAY Engine roadmap

This file tracks what is actually missing in the current repository. Completed infrastructure is not kept as a fake TODO.

## Phase 0 — foundation — complete

- [x] Armenian-first multilingual web shell (HY / EN / RU)
- [x] HAY normalization endpoint
- [x] Armenian pronunciation/code-switch dictionary
- [x] commercial number and currency speech normalization (USD / AMD / EUR / GEL)
- [x] storyboard contract and deterministic fallback
- [x] optional OpenAI creative planner
- [x] ElevenLabs + Azure Armenian speech provider layer
- [x] Eastern / Western Armenian architecture switch
- [x] deterministic Armenian quality release gate

## Phase 1 — creator + Marketing OS — production foundation complete

- [x] one-request CreatorProject pipeline
- [x] account/auth + owner-scoped project/business persistence
- [x] automatic caption cues + provider alignment support
- [x] asset direction and text-free generated-media prompts
- [x] OpenAI scene image generation adapter
- [x] live 9:16 browser preview + scene timeline
- [x] deterministic Armenian typography overlay architecture
- [x] Armenian voice catalog / picker
- [x] asset upload + object-storage schema
- [x] Veo video adapter
- [x] durable render API / queue / worker / status path
- [x] content presets architecture
- [x] Marketing OS: analyze → plan → create → approve → publish → learn
- [x] Campaign Brain, Content Series and Content Memory
- [x] Smart Calendar and channel publishing policies
- [x] campaign analytics and controlled Experiment Runner
- [x] first-party Conversion Bridge attribution
- [x] secure multi-business Studio workspaces
- [x] Pexels stock-media adapter with portrait video → photo fallback, attribution metadata and render integration
- [ ] additional video provider adapters (Kling / Seedance class) for cost/quality routing
- [ ] larger production Armenian typography template library

## Phase 2 — Armenian language moat

- [x] Eastern Armenian deterministic evaluation suite
- [x] business-domain Armenian regression packs
- [x] Armenian/English code-switch regression coverage
- [x] commercial currency / brand-suffix / social-name regression pack
- [x] Armenian transcript correction layer with protected-value fail-safe
- [x] versioned curated-core pronunciation registry + inspectable pronunciation API
- [x] persistent reviewed/account/business pronunciation registry
- [x] DB-managed pronunciation version increment + append-only audit snapshots
- [x] pronunciation management UI with provenance fields and business scoping
- [x] runtime precedence: business → account → HAY-reviewed system → curated core
- [x] runtime pronunciation override regression gate
- [x] consent-aware human correction capture with private-by-default storage
- [x] separate product-improvement / benchmark / model-training consent controls
- [x] reviewer queue gated by server-only email allowlist
- [x] correction withdrawal that revokes linked dataset eligibility
- [x] correction and dataset append-only provenance snapshots
- [x] deterministic correction-consent policy release gate
- [x] Language Lab for pronunciation / transcription / captions / translation testing
- [x] blind native-speaker benchmark protocol + `/benchmark` review harness
- [ ] collect enough independent native-speaker reviews to publish statistically useful provider comparisons
- [ ] STT provider benchmark and quality/cost routing (OpenAI adapter is live; Chirp 3 is the next benchmark adapter)
- [ ] reviewed Western Armenian evaluation set
- [ ] larger Armenian/Russian/English code-switch benchmark
- [ ] reviewed Armenia names / brands / places pronunciation graph at useful scale

## Phase 3 — commercial core

- [x] Free / Creator / Growth / Business plan definitions
- [x] owner-scoped account entitlement schema
- [x] append-only Studio usage ledger
- [x] server-side content / video / voice usage enforcement
- [x] brand-workspace and social-channel limit enforcement
- [x] live Studio plan / usage visibility
- [x] provider-neutral hosted checkout contract
- [x] trusted server-to-server billing entitlement sync endpoint
- [x] persistent Studio auth gate and plan-preserving magic-link flow
- [x] commercial readiness diagnostics in `/api/setup/status`
- [x] server-only developer credential schema with one-time raw secret and SHA-256-at-rest keys
- [x] separate developer API request / character / audio-byte metering
- [x] fail-closed per-key hourly API rate-limit infrastructure
- [ ] choose/configure production billing provider and hosted checkout URLs
- [ ] wire that provider's verified webhook adapter to `/api/billing/sync`
- [ ] define developer API quota / overage pricing by commercial plan
- [ ] enforce plan-level developer API monthly quota / overage policy after pricing is approved
- [ ] invoice / receipt / tax workflow required by the selling entity
- [ ] transactional lifecycle email (trial, payment, limit, failed payment, cancellation)

## Phase 4 — API and proprietary data moat

- [x] `/normalize`
- [x] `/pronounce` + layered persistent pronunciation runtime
- [x] `/voice` using the active pronunciation registry
- [x] `/transcribe` with Armenian post-correction
- [x] standalone `/captions` with cues + SRT + WebVTT
- [x] `/translate` with Armenian-first syntax and protected-value preservation
- [x] model/quality dashboard via `/quality` and `/api/quality`
- [x] interactive `/language` Language Lab surface
- [x] `/pronunciations` owner/business Dictionary Console
- [x] `/corrections` consent-aware Teach HAY surface
- [x] owner correction capture/history/withdrawal API
- [x] reviewer-only correction decision API
- [x] general `dataset_records` provenance / license / consent registry
- [x] append-only dataset provenance history
- [x] revocable developer authentication / API keys
- [x] stable `/api/v1/language/*` developer surface
- [x] `/developers` key + usage console
- [x] API usage metering distinct from Studio subscriptions
- [x] persistent versioned pronunciation dictionary management
- [x] pronunciation provenance + consent/license fields with append-only history
- [ ] fine-tuned Armenian speech/language components only where blind benchmarks justify them and eligible consented data exists

## Go-live checklist

1. Create a dedicated HAY Supabase project; do not reuse Meqena or the old shared Margaryan Labs database.
2. Apply the canonical HAY Supabase migrations through `009_language_corrections_and_dataset_registry.sql`.
3. Verify `/api/setup/status` reports the commercial/developer schemas, pronunciation registry and correction flywheel correctly.
4. Configure at least one server-only `HAY_LANGUAGE_REVIEWER_EMAILS` reviewer before operating the correction review queue.
5. Configure provider keys and workers required by the launch package; add `PEXELS_API_KEY` if Creator should resolve stock scenes automatically.
6. Configure Creator / Growth / Business hosted checkout URLs and `HAY_BILLING_SYNC_SECRET`.
7. Verify the chosen payment provider's signed webhook, then call HAY `/api/billing/sync` from that trusted adapter.
8. Set `HAY_ENFORCE_PLANS=true` only after migration + billing sync are verified.
9. For Developer API launch, choose a positive `HAY_DEVELOPER_API_HOURLY_REQUEST_LIMIT`, create a test `hay_live_*` key, verify success + `429` behavior + usage recording + revoke, then set `HAY_DEVELOPER_API_ENABLED=true`.
10. In `/pronunciations`, create/update/archive an account override and one owned-business override; confirm versions increment and runtime precedence falls back correctly.
11. In `/corrections`, verify a private no-consent correction never appears in the reviewer queue; verify a product-improvement-consented correction can be accepted; then withdraw it and confirm linked dataset eligibility is withdrawn.
12. Verify a consented pronunciation correction can be promoted to `hay-reviewed`, then withdraw it and confirm only the matching consent-sourced pronunciation is archived.
13. Generate a Creator project containing at least one stock scene and verify Pexels credit/source survives preview, save and render.
14. Run `npm run typecheck`, `npm run quality`, `npm run build`, render-worker check and publish-worker check.
15. Onboard the first real businesses in managed mode and measure time-to-first-useful-plan, publish success and attributed outcomes.
16. Collect independent blind native-speaker benchmark reviews before making comparative "best Armenian" claims.

## Non-goal

Do not train a frontier LLM or video foundation model from scratch. HAY wins by owning the Armenian-specific normalization, pronunciation, evaluation, consented correction flywheel, provenance, workflow, developer infrastructure, business context, outcome memory and proprietary reviewed data around interchangeable foundation providers.
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
- [ ] stock-media search adapter
- [ ] additional video provider adapters (Kling / Seedance class) for cost/quality routing
- [ ] larger production Armenian typography template library

## Phase 2 — Armenian language moat

- [x] Eastern Armenian deterministic evaluation suite
- [x] business-domain Armenian regression packs
- [x] Armenian/English code-switch regression coverage
- [x] commercial currency / brand-suffix / social-name regression pack
- [ ] STT provider benchmark and routing
- [ ] Armenian transcript correction layer
- [ ] pronunciation management UI backed by versioned dictionary entries
- [ ] reviewed Western Armenian evaluation set
- [ ] larger Armenian/Russian/English code-switch benchmark
- [ ] reviewed Armenia names / brands / places pronunciation graph
- [ ] human correction capture with explicit consent
- [ ] blind native-speaker benchmark for naturalness, pronunciation and prosody

## Phase 3 — commercial core

- [x] Free / Creator / Growth / Business plan definitions
- [x] owner-scoped account entitlement schema
- [x] append-only usage ledger
- [x] server-side content / video / voice usage enforcement
- [x] brand-workspace and social-channel limit enforcement
- [x] live Studio plan / usage visibility
- [x] provider-neutral hosted checkout contract
- [x] trusted server-to-server billing entitlement sync endpoint
- [x] persistent Studio auth gate and plan-preserving magic-link flow
- [x] commercial readiness diagnostics in `/api/setup/status`
- [ ] choose/configure production billing provider and hosted checkout URLs
- [ ] wire that provider's verified webhook adapter to `/api/billing/sync`
- [ ] invoice / receipt / tax workflow required by the selling entity
- [ ] transactional lifecycle email (trial, payment, limit, failed payment, cancellation)

## Phase 4 — API and proprietary data moat

- [x] `/normalize`
- [x] `/voice`
- [x] model/quality dashboard via `/quality` and `/api/quality`
- [ ] public developer authentication / API keys
- [ ] `/pronounce`
- [ ] `/transcribe`
- [ ] standalone `/captions`
- [ ] `/translate`
- [ ] API usage metering distinct from Studio subscriptions
- [ ] versioned pronunciation dictionaries
- [ ] dataset provenance and license registry in persistence
- [ ] fine-tuned Armenian speech/language components only where blind benchmarks justify them

## Go-live checklist

1. Apply Supabase migrations through `007_commercial_core.sql` in the dedicated HAY project.
2. Configure provider keys and workers required by the launch package.
3. Configure Creator / Growth / Business hosted checkout URLs and `HAY_BILLING_SYNC_SECRET`.
4. Verify the chosen payment provider's signed webhook, then call HAY `/api/billing/sync` from that trusted adapter.
5. Set `HAY_ENFORCE_PLANS=true` only after migration + billing sync are verified.
6. Run `npm run typecheck`, `npm run quality`, `npm run build`, render-worker check and publish-worker check.
7. Onboard the first real businesses in managed mode and measure time-to-first-useful-plan, publish success and attributed outcomes.
8. Run the blind native-speaker Armenian benchmark before making comparative "best Armenian" claims.

## Non-goal

Do not train a frontier LLM or video foundation model from scratch. HAY wins by owning the Armenian-specific normalization, pronunciation, evaluation, workflow, business context, outcome memory and proprietary reviewed data around interchangeable foundation providers.

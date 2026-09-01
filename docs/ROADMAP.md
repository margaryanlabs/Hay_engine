# HAY Engine roadmap

## Phase 0 — foundation (current)

- [x] Armenian-first multilingual web shell (HY / EN / RU)
- [x] HAY normalization endpoint
- [x] initial Armenian pronunciation/code-switch dictionary
- [x] number and currency speech normalization
- [x] storyboard contract and demo fallback
- [x] optional OpenAI creative planner
- [x] optional ElevenLabs Armenian TTS with timestamps
- [x] Eastern / Western Armenian architecture switch

## Phase 1 — creator MVP

- [ ] account/auth + project persistence
- [ ] Armenian voice picker and voice quality test suite
- [ ] Armenian subtitle segmentation from provider timestamps
- [ ] upload image/video assets
- [ ] stock media search adapter
- [ ] image generation adapter
- [ ] Veo/Kling/Seedance-style video provider adapters
- [ ] Remotion composition and MP4 render worker
- [ ] Reel presets: Ad / Product / Restaurant / Real estate / News / Finance
- [ ] typography templates that render Armenian text deterministically

## Phase 2 — Armenian language infrastructure

- [ ] STT provider benchmark and routing
- [ ] Armenian transcript correction layer
- [ ] pronunciation management UI
- [ ] Eastern Armenian evaluation set
- [ ] Western Armenian evaluation set
- [ ] Armenian/Russian/English code-switch benchmark
- [ ] names/brands/places lexicon
- [ ] human correction capture with explicit consent

## Phase 3 — API and data moat

- [ ] public developer API
- [ ] `/normalize`, `/pronounce`, `/transcribe`, `/voice`, `/captions`, `/translate`
- [ ] usage metering and billing
- [ ] versioned dictionaries
- [ ] dataset provenance and license registry
- [ ] model evaluation dashboard
- [ ] fine-tuned Armenian speech/language components where benchmarks justify it

## Non-goal

Do not train a full frontier LLM or video foundation model from scratch at this stage. Build Armenian-specific intelligence and evaluate every replacement based on measurable quality/cost gains.

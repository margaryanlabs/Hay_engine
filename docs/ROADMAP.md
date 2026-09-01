# HAY Engine roadmap

## Phase 0 — foundation

- [x] Armenian-first multilingual web shell (HY / EN / RU)
- [x] HAY normalization endpoint
- [x] initial Armenian pronunciation/code-switch dictionary
- [x] number and currency speech normalization
- [x] storyboard contract and demo fallback
- [x] optional OpenAI creative planner
- [x] optional ElevenLabs Armenian TTS with timestamps
- [x] Eastern / Western Armenian architecture switch

## Phase 1 — creator MVP (in progress)

- [x] one-request CreatorProject pipeline
- [x] automatic caption cue generation
- [x] asset direction and text-free generated-media prompts
- [x] OpenAI scene image generation adapter
- [x] live 9:16 browser preview + scene timeline
- [x] deterministic Armenian typography overlay architecture
- [x] dedicated Remotion composition / MP4 render-worker scaffold
- [x] provider health diagnostics
- [ ] account/auth + project persistence
- [ ] Armenian voice picker and voice quality test suite
- [ ] use ElevenLabs provider timestamps for word-accurate subtitle segmentation
- [ ] upload image/video assets to object storage
- [ ] stock media search adapter
- [ ] Veo/Kling/Seedance-style video provider adapters
- [ ] render queue + storage callback + downloadable MP4
- [ ] Reel presets: Ad / Product / Restaurant / Real estate / News / Finance
- [ ] production Armenian typography template library

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

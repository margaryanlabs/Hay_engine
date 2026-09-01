# HAY Armenian Quality Layer

HAY treats Armenian language quality as a measured product capability, not a prompt-writing preference.

## Release gate

Every web release runs `npm run quality`. A release fails when any deterministic Armenian regression case fails.

The current suite covers:

- standard literary Eastern Armenian preservation
- natural contemporary Eastern Armenian simplification
- mild Yerevan-casual delivery without forced slang
- Armenian/English code-switching
- brand and acronym pronunciation
- Armenian definite/genitive suffixes on Latin-script brands
- prices, currencies, percentages and compact financial values
- restaurant/hospitality, beauty, real estate, retail, finance/tech, creator and customer-support language

`/quality` exposes the current score and every evaluated output. `/api/quality` exposes the same report for automation.

## Quality principles

1. **Meaning before style.** Naturalization may simplify syntax but must preserve facts, prices, names, CTA and product terms.
2. **Exact numbers.** Speech normalization must not change financial or commercial values for convenience.
3. **No fake slang.** Yerevan mode can use forms such as `էս`, `էդ`, `հա` when natural, but it must not manufacture slang, Russian loanwords or misspell Armenian intentionally.
4. **Standard remains stable.** `standard` is the control mode and should not become casual automatically.
5. **Display text and spoken text are separate.** A screen may show `BTC — $110K`; TTS can say `Բիթքոյնը՝ հարյուր տասը հազար դոլար`.
6. **Provider-independent evaluation.** Language normalization is tested independently from ElevenLabs, Azure, Gemini or any future speech provider.
7. **Licensed voices only.** Public corpora are not a pool for cloning identifiable speakers. Use them according to their licenses for research/evaluation, and use licensed/consented voices for HAY voice products.

## Growing from 50 to 500+ cases

Do not bulk-generate hundreds of synthetic sentences and call that a dataset. Expand in reviewed packs.

### Pack A — Armenia business language

Add human-reviewed examples from:

- tourism and hotels
- automotive/dealers
- clinics and dental
- education and courses
- banking/fintech
- delivery/e-commerce
- restaurants/cafes
- beauty/fashion
- real estate
- creators/media

Each domain should include CTA, offer, explanation, customer support, pricing and short-form video narration.

### Pack B — spoken Armenian

Collect consented or properly licensed examples representing:

- educated conversational Eastern Armenian
- Yerevan casual speech
- regional variation without caricature
- Western Armenian
- Armenian + English code-switching
- Armenian + Russian code-switching where genuinely used

Human reviewers should mark acceptable alternatives rather than force one canonical sentence when multiple forms are natural.

### Pack C — pronunciation graph

Maintain structured entries for:

- global brands
- Armenian company/place/person names
- financial tickers
- currencies and units
- social networks
- technology acronyms
- common imported terms

Store separate `display`, `spoken`, `case/suffix`, `locale`, `domain` and provenance fields.

## Human evaluation

Deterministic CI catches regressions but cannot decide whether a voice sounds truly Armenian. Add periodic blind review with native speakers.

Recommended rubric (1–5 each):

- naturalness
- grammatical correctness
- meaning preservation
- pronunciation
- brand-safe tone
- code-switch naturalness
- prosody (for audio)

Keep reviewer agreement and comments. Do not optimize only to a single reviewer.

## Dataset provenance

Every future training/evaluation record should carry provenance:

- source
- license/consent basis
- collection date
- dialect/region when legitimately known
- intended use: evaluation / training / pronunciation / ASR
- whether redistribution is allowed

Private customer content must not become training data by default. Explicit opt-in and clear contractual terms are required before reuse.

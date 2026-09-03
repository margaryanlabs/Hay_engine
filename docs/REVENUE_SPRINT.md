# HAY Engine — revenue sprint

HAY is already larger than a creator MVP. The fastest path to revenue is to sell a business outcome first and complete the remaining SaaS infrastructure behind that offer.

## Current sellable core

- Armenian-first business and competitor intelligence
- Campaign Brain and 4-week content series
- Creator pipeline for posts, Reels, captions, visuals and voice
- Armenian language normalization with Standard / Natural / Yerevan / Western modes
- release-gated Armenian regression suite
- Content Memory and anti-repetition planning
- approval inbox and publishing policies
- Armenia-local Smart Calendar
- Instagram / TikTok / YouTube connection and publishing pipeline
- Campaign Analytics and controlled Experiment Runner
- multi-business workspaces
- privacy-first first-party Conversion Bridge / attribution

## P0 — get to revenue

### 1. Sell a managed Launch Sprint before waiting for perfect self-serve

Offer HAY as an Armenian AI marketing department rather than as another content generator.

Suggested launch package:

1. connect one business and its channels;
2. analyze website, offer and competitors;
3. create positioning and a 30-day campaign plan;
4. produce the first approved Armenian content batch;
5. configure Smart Calendar and publishing policy;
6. install first-party Conversion Bridge where applicable;
7. review results after the first cycle and run the next experiment.

This can be sold as a one-time onboarding / implementation service plus a recurring Growth or Business subscription. The service price should be validated with the first 5–10 customers rather than hard-coded into the product.

### 2. Make time-to-value under 10 minutes

The self-serve first run should be:

`business URL / socials → business scan → Armenian positioning → 7-day plan → 3 ready assets → approval`

Do not expose the whole operating system before the first useful output exists.

### 3. Add billing and entitlement enforcement

The repo has plan definitions but still needs production billing infrastructure:

- checkout and subscription state;
- verified payment webhooks;
- usage metering;
- enforcement for brands, channels, content assets, video credits and voice minutes;
- upgrade / downgrade / cancellation lifecycle;
- invoices / receipts where required;
- operator view for payment and entitlement exceptions.

Provider costs for video and voice must be measured before unlimited plans are offered.

### 4. Production readiness gate

Before charging broadly, verify in one dedicated HAY environment:

- all Supabase migrations are applied, including first-party attribution;
- object storage is configured;
- render worker is reachable and produces stored MP4 output;
- publish worker is reachable and retries safely;
- OAuth callbacks use production URLs;
- Instagram / TikTok / YouTube publishing is tested with real accounts;
- provider health exposes missing configuration without leaking secrets;
- conversion events are origin-validated and business-scoped;
- a failed provider degrades safely instead of creating fake success states.

## P1 — make Armenian quality a moat

### Public benchmark, not a slogan

Build a versioned benchmark that separates:

- Standard Eastern Armenian;
- natural contemporary Eastern Armenian;
- Yerevan casual;
- Western Armenian;
- Armenian + English code-switch;
- Armenian + Russian code-switch;
- numbers, prices and currencies;
- brand / acronym pronunciation;
- Armenian suffixes on Latin-script names;
- business copy by vertical;
- voice naturalness and prosody.

Run blind native-speaker review against the strongest available text and speech providers. Publish methodology, sample size, reviewer agreement and per-category scores. Only use a “best Armenian” claim when the independent evidence supports the exact claim.

### Grow the reviewed quality set

Move from deterministic regression coverage to 250–500+ reviewed cases across:

- restaurants / hospitality;
- tourism / hotels;
- real estate;
- beauty / fashion;
- automotive;
- healthcare / dental;
- education;
- banking / fintech;
- retail / e-commerce;
- creator / media;
- support conversations.

Synthetic expansion alone is not a moat. Each quality record should have provenance and review status.

### Close the remaining language loop

- STT provider benchmark and routing;
- Armenian transcript correction layer;
- word-accurate captions from provider timestamps;
- pronunciation management UI per business;
- versioned names / brands / places lexicon;
- consented human correction capture;
- public quality dashboard with version history.

## P2 — scale after the first repeatable sales

- public developer API and API keys;
- usage billing for language / voice / creator endpoints;
- agency white-label and account hierarchy;
- role-based team approvals;
- reusable vertical playbooks;
- customer success / retention reporting;
- fine-tuned Armenian components only where benchmark evidence shows a measurable quality or cost advantage.

## What HAY should claim now

Strong and defensible:

> Armenian-first AI Marketing OS with a dedicated Armenian language quality layer.

Also defensible:

> Built for Armenian, not translated into Armenian.

Do not treat an internal 100% regression pass as an independent competitive score. The strongest long-term positioning is to turn Armenian quality into a public, repeatable benchmark that competitors have to beat.

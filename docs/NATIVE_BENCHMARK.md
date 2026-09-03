# HAY Native Speaker Benchmark

HAY uses two separate quality systems:

1. `npm run quality` / `/quality` — deterministic engineering regression checks.
2. `/benchmark` — blinded human review for questions deterministic tests cannot answer reliably, such as naturalness, local authenticity and overall preference.

Never present the deterministic score as evidence that HAY is better than another model. Comparative claims require real blinded reviews.

## Protocol

### 1. Freeze the test set

Use the versioned cases in `lib/hay/native-benchmark.ts`. If a case is changed materially, bump the benchmark version before collecting more reviews.

The initial pack covers hospitality, retail, real estate, finance/tech, creator content, automotive, healthcare, education, tourism and support. Cases include commercial values, HY/EN code-switching and speech-safe pronunciation tasks.

### 2. Capture provider output exactly

For each case:

- run the same prompt/constraints against every provider under comparison
- record provider/model/version/date and relevant generation settings outside the blinded text
- paste the output without fixing punctuation, grammar or wording by hand
- do not add a candidate if it was manually edited after generation

If HAY uses an Armenian post-processing layer, that processed HAY output is the HAY candidate. The benchmark is measuring the product output the customer receives, not a raw foundation-model response.

### 3. Blind before review

`/benchmark` shuffles candidates using the case id + review-session id and exposes only opaque candidate letters. Provider identity is revealed only after every candidate has a completed score.

A reviewer should not be told which letter is HAY and should not infer provider identity from UI ordering.

### 4. Reviewer rubric

Score every candidate from 1 to 5 for:

- naturalness
- grammar
- meaning preservation
- local Armenian authenticity
- code-switch / imported-term handling
- brand safety

The reviewer can also add a short note and select one preferred candidate after scoring all outputs.

### 5. Reviewer quality

Use fluent native Armenian speakers for Armenian benchmark claims. Do not infer dialect, region or identity attributes. Record those attributes only when a reviewer explicitly volunteers them and consents to their use.

Avoid relying on one reviewer. Keep independent reviews separate so disagreement remains visible instead of being silently averaged away.

### 6. Export and aggregate

The current benchmark lab exports one review as JSON. Store raw review exports unchanged. Aggregation should retain:

- benchmark version
- case id
- anonymized review id
- candidate score dimensions
- preferred candidate
- provider/model reveal map
- provider/model version/date from the operator run sheet

Do not discard losing outputs or reviewer comments when publishing a result.

## Minimum evidence before a marketing claim

HAY should not publish language such as `#1 Armenian AI`, `best Armenian AI`, or a provider win rate until:

- the provider comparison uses the same frozen prompt set
- provider identities were hidden during review
- multiple independent native speakers reviewed the outputs
- results cover more than one business domain
- the model/provider versions and benchmark date are disclosed
- raw counts and reviewer disagreement are retained
- HAY does not exclude cases it lost after seeing the results

Prefer precise claims such as `preferred in X/Y blinded reviews on benchmark version Z` over broad superiority language.

## What this benchmark does not prove

A text benchmark does not prove TTS prosody quality, STT word error rate, latency, cost or reliability. Those require separate measurements. Speech evaluation should include actual audio samples and transcription evaluation should use a fixed human-verified reference transcript.

# HAY AI Employee

## Product thesis

HAY Employee is not an Armenian wrapper around one LLM or voice vendor. Foundation models, ASR, TTS and telephony are replaceable suppliers. HAY owns the Armenian operating behavior and the business execution layer around them.

The product is a monthly-hireable digital employee for Armenian businesses: receptionist, dispatcher, sales assistant and order-intake operator. It should answer calls 24/7, speak contemporary Armenian naturally, understand business context, collect the right information, create structured work and hand off to a human when it should not act alone.

## What HAY must own

### 1. Armenian Interaction Kernel

- contemporary Eastern Armenian and optional Yerevan conversational style
- Eastern / Western architecture boundary
- Armenian names and surnames
- Armenian phone-number confirmation
- AMD / USD / EUR / GEL amounts and spoken number normalization
- dates, times and relative Armenian expressions
- addresses, place names and business names
- Armenian + Russian + English code-switching
- pronunciation registry and business-specific pronunciation overrides
- short spoken syntax instead of translated bureaucratic Armenian
- interruption-safe response length and one-question-at-a-time behavior

Raw Armenian support from a provider is useful, but is not the moat.

### 2. Business Action Gate

The model never gets to declare that an external action happened. It may only propose a typed action:

- `book_appointment`
- `create_lead`
- `create_callback`
- `take_order`
- `handoff_human`

HAY validates capability, business ownership, required fields, caller confirmation, idempotency and action policy before execution. High-risk or unsupported operations fail to a human.

Payment capture is deliberately not part of the first worker. Taking an order or payment intent and charging money are different permissions.

### 3. Business memory

Every employee belongs to a real HAY business workspace and should eventually learn only from authorized business sources: services, prices, hours, locations, inventory/availability connectors, policies, CRM state and approved corrections.

The agent must say it does not know rather than inventing availability, price, booking success or policy.

### 4. Outcome memory

The important unit is not a generated sentence. It is an outcome derived from executed HAY actions, not model self-report:

- `appointment_request`
- `order_captured`
- `callback_requested`
- `lead_captured`
- `human_handoff`
- `resolved_without_action`
- `voice_transport_failed`

This gives HAY a proprietary Armenian business-conversation evaluation loop that generic model vendors do not have by default. Outcome classification does not require storing raw audio or full call transcripts.

## Realtime architecture

Initial production path:

`phone/browser audio`
→ `realtime speech provider (ASR, VAD, interruption, TTS)`
→ `HAY voice-worker`
→ `atomic seat/minute/concurrency admission`
→ `POST /api/employee/realtime-turn`
→ `HAY employee runtime`
→ `Armenian interaction policy`
→ `business action proposal`
→ `deterministic caller confirmation`
→ `HAY action gate / business connector`
→ `short Armenian reply`
→ `realtime TTS`
→ `outcome + billable-minute finalization`

The first worker uses ElevenLabs Speech Engine because it can keep ASR/TTS/turn-taking outside HAY while letting our server own the LLM/business logic. Provider interfaces must remain replaceable.

For real PSTN calls the first bridge target is the documented Twilio Media Streams + Speech Engine custom-LLM pattern. Twilio and ElevenLabs both use μ-law 8 kHz in that bridge, avoiding transcoding. A local Armenian/SIP carrier is preferred where it materially improves inbound numbering or telephony economics.

## Call transaction semantics

A phone side effect is a two-step transaction:

1. HAY proposes and reads back the exact action/data.
2. A deterministic Armenian confirmation parser resolves the next `այո / հա / ճիշտ է / հաստատում եմ` or rejection against the **same call session and same stored proposal**.

The LLM does not get a second chance to regenerate or silently change the amount/time/name between the read-back and caller confirmation.

An appointment remains an `appointment_request` until a real calendar/booking connector confirms a slot. HAY must never tell the caller that an external booking succeeded merely because the model proposed it.

## Privacy default

- do not persist raw call audio by default
- do not persist full transcripts by default
- persist outcome summaries and auditable business actions
- recording/long transcript retention requires an explicit business setting and appropriate caller disclosure/consent where required
- caller phone numbers should be masked for UI and hashed when only identity correlation is needed
- provider credentials are server-only
- the realtime voice worker never receives Supabase service-role credentials

## Subscription and usage

Employee billing is separate from Marketing OS token/asset usage. Migration `016_ai_employee_subscriptions.sql` introduces:

- employee seats
- included call minutes
- concurrent-call limits
- maximum duration per call
- atomic per-call reservation before the first HAY brain turn
- exact final billable seconds on close/disconnect

Active reservations count against the monthly minute pool immediately, preventing two concurrent calls from spending the same remaining minutes.

Initial launch catalog in code is intentionally adjustable before public pricing is frozen:

- Trial — 1 employee / 30 min
- Reception — 49,900 AMD / 1 employee / 150 min
- Business — 99,000 AMD / 2 employees / 500 min
- Team — 199,000 AMD / 5 employees / 1,500 min

Final public pricing should follow measured Armenian call latency, completion rate and blended inbound telephony + realtime speech cost, not generic token pricing.

## Frozen Armenian Call Benchmark

`hay-employee-call-v1-2026-09-04` lives in `lib/employee/call-benchmark.ts` and is an explicit release gate. Its first 12 scenarios cover:

- Armenian name + phone + appointment request
- 15,000 AMD vs 50,000 AMD
- caller phone-number correction
- Armenian surname spelling
- relative date/time phrasing
- Armenian/Russian/English code-switching
- angry caller / human handoff
- caller prompt injection
- unsupported price confirmation trap
- order quantity vs unit price
- interruption followed by changed appointment request
- fake payment-success instruction

The benchmark scores **action correctness, caller-confirmation correctness, protected-value preservation, forbidden claims and handoff behavior**. Naturalness remains important, but a pleasant voice cannot compensate for an incorrect business action.

The production evidence layer should expand this frozen core to 100+ names, dates, phones, amounts, addresses and noisy native-speaker calls before broad launch.

## Required migrations

Apply after the existing HAY migrations through `013_atomic_billing_events.sql`:

1. `014_ai_employees.sql` — employee configuration, sessions and auditable action proposals.
2. `015_ai_employee_inbox.sql` — operational lead/callback/order/appointment-request inbox.
3. `016_ai_employee_subscriptions.sql` — seats, included call minutes, concurrency and atomic call admission/finalization.

Do not set `HAY_EMPLOYEE_ENFORCE_SUBSCRIPTION=true` until migration 016 is installed and `/api/employee/readiness` reports subscription readiness.

## User/operator prerequisites for the first real phone pilot

Code can be built without these, but real inbound phone calls require:

- dedicated HAY Supabase migrations through `016_ai_employee_subscriptions.sql`
- at least one configured HAY business and active AI Employee
- OpenAI key for the first brain provider (replaceable later)
- ElevenLabs key + Speech Engine resource for the first realtime speech transport
- a deployed public voice worker and `HAY_VOICE_WORKER_SECRET`
- a phone/SIP/Twilio-style inbound number/bridge
- actual business services, hours, booking rules, escalation contact and allowed actions

The product should pass deterministic/security tests, browser behavior tests, then one controlled phone number and the expanded native-speaker call benchmark before broad customer rollout.

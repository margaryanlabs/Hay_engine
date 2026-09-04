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

The important unit is not a generated sentence. It is an outcome:

- answered
- resolved
- lead created
- callback requested
- appointment requested/booked
- order captured
- transferred to human
- abandoned
- failed

This gives HAY a proprietary Armenian business-conversation evaluation loop that generic model vendors do not have by default.

## Realtime architecture

Initial production path:

`phone/browser audio`
→ `realtime speech provider (ASR, VAD, interruption, TTS)`
→ `HAY voice-worker`
→ `POST /api/employee/realtime-turn`
→ `HAY employee runtime`
→ `Armenian interaction policy`
→ `business action proposal`
→ `HAY action gate / business connector`
→ `short Armenian reply`
→ `realtime TTS`

The first worker uses ElevenLabs Speech Engine because it can keep ASR/TTS/turn-taking outside HAY while letting our server own the LLM/business logic. Provider interfaces must remain replaceable.

## Privacy default

- do not persist raw call audio by default
- do not persist full transcripts by default
- persist outcome summaries and auditable business actions
- recording/long transcript retention requires an explicit business setting and appropriate caller disclosure/consent where required
- caller phone numbers should be masked for UI and hashed when only identity correlation is needed
- provider credentials are server-only

## First commercial shape

HAY Employee should be sold as an add-on / employee subscription, not bundled into unlimited generic tokens. The commercial unit is an employee seat plus included call minutes, with overage after measured provider cost is known.

Do not lock pricing before the real Armenian latency/quality benchmark and blended per-minute provider cost are measured. The schema and worker should stay provider-neutral so margin can improve by routing providers later.

## Launch benchmark before accepting real customer calls

Minimum test pack:

1. 100+ Armenian names/surnames.
2. 100+ Armenian dates/times including relative phrasing.
3. 100+ phone numbers and confirmation turns.
4. AMD prices and ambiguous number pairs (15,000 vs 50,000 etc.).
5. Yerevan addresses, neighborhoods and common Armenian place names.
6. Armenian/Russian/English code-switching.
7. interruptions and backchannels.
8. noisy phone audio.
9. angry caller and human-transfer cases.
10. prompt-injection attempts from a caller.
11. hallucination traps for unavailable prices/inventory/appointments.
12. action confirmation and duplicate/retry tests.

A pleasant demo voice is not sufficient for launch.

## User/operator prerequisites for the first real phone pilot

Code can be built without these, but real inbound phone calls require:

- dedicated HAY Supabase migrations through `014_ai_employees.sql`
- at least one configured HAY business and active AI Employee
- OpenAI key (brain initially; replaceable later)
- ElevenLabs key + Armenian-capable realtime voice / Speech Engine resource for the first transport
- a deployed public WebSocket voice worker
- a phone/SIP/Twilio-style number/bridge for real telephone calls
- actual business services, hours, booking rules, escalation contact and allowed actions

The product should first pass browser/WebRTC voice tests, then one controlled phone number, then real businesses.
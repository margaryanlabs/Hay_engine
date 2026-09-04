# HAY Employee Voice Worker

This worker is the realtime speech transport for HAY AI Employee. It intentionally does **not** own the business brain.

Flow:

`caller audio → ElevenLabs Speech Engine (ASR / turn detection / TTS) → this worker → HAY /api/employee/realtime-turn → HAY Armenian policy + business rules + action gate → spoken reply`

The first pilot maps one Speech Engine resource to one HAY employee with `HAY_DEFAULT_EMPLOYEE_ID`. This keeps the initial phone deployment easy to audit. Multi-tenant engine-to-employee routing should be added only after the first real call benchmark is stable.

## Required secrets

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_SPEECH_ENGINE_ID`
- `HAY_APP_URL` — deployed HAY app HTTPS origin
- `HAY_VOICE_WORKER_SECRET` — same strong server-only secret configured in the HAY app
- `HAY_DEFAULT_EMPLOYEE_ID` — active employee from migration 014

Optional:

- `PORT=3001`
- `HAY_VOICE_DEBUG=false`

## Setup

1. Apply `supabase/014_ai_employees.sql`.
2. Create a business and AI Employee in `/employee`, then activate that employee for the pilot.
3. Deploy this worker to a host that accepts public WebSocket connections.
4. Create an ElevenLabs Speech Engine whose upstream `ws_url` points to this worker. Keep Speech Engine authentication enabled.
5. Configure Armenian language / voice in the Speech Engine resource and use zero/short retention unless the business has a lawful reason and caller consent to retain audio.
6. Connect the Speech Engine conversation to a browser/WebRTC client first. Add a real phone/SIP/Twilio bridge only after the same Armenian benchmark passes in browser audio.

The worker never receives Supabase service credentials. It can call only the dedicated server-to-server HAY Employee endpoint with `HAY_VOICE_WORKER_SECRET`.

## Production rule

Do not treat a fluent voice as proof of correctness. Before real calls, benchmark Armenian names, dates, phone numbers, AMD prices, addresses, code-switching, interruptions, angry callers, human handoff and appointment confirmation. HAY should fail to a human rather than invent a booking, price, availability or payment result.
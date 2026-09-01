# HAY Marketing OS

HAY Marketing OS turns the HAY language/creator foundation into an Armenian-first marketing operating system for businesses, creators, restaurants, hotels, real estate, retail and service companies.

## Operating loop

```text
CONNECT BUSINESS
  ↓
ANALYZE
  ├─ website / offer / audience
  ├─ brand DNA
  └─ competitor radar
  ↓
STRATEGIZE
  ├─ positioning
  ├─ content pillars
  ├─ channel roles
  └─ conversion path
  ↓
CREATE
  ├─ script
  ├─ Armenian language normalization
  ├─ voice + aligned captions
  ├─ images / Veo scenes / uploads
  └─ deterministic Armenian typography
  ↓
APPROVE
  ├─ copilot
  ├─ approval queue (default)
  └─ autopublish (explicit opt-in only)
  ↓
PUBLISH
  ├─ Instagram / Facebook via approved Meta app
  ├─ TikTok Content Posting API
  ├─ YouTube Data API
  └─ additional adapters
  ↓
LEARN
  ├─ post outcomes
  ├─ hook / format performance
  └─ next content plan
```

## Security model

- Social passwords are never collected.
- Provider authorization happens through OAuth.
- OAuth state is bound to an authenticated HAY user and an owned business.
- Access/refresh tokens are stored in Supabase Vault and public tables keep only a `credential_ref`.
- Public business/content tables use RLS.
- Autopublish is blocked until the required account is actually connected.
- User-generated media uploads are authenticated and restricted by type/size.

## Current implementation

- Business persistence API
- safe public website intelligence with SSRF protections
- competitor input + strategy analysis
- 7–30 day content planning
- Marketing Autopilot state machine
- social connector readiness
- OAuth initiation/callback/token exchange for TikTok, YouTube and configurable Meta setup
- encrypted social credential contract via Supabase Vault
- publishing job contract
- Creator project persistence
- Veo 3.1 async scene generation adapter
- Remotion render dispatch contract

## External activation still required

The code cannot bypass provider approval. A production installation needs the business owner to authorize each account and the HAY developer apps to receive the scopes required by Meta/TikTok/Google. Provider review requirements remain provider-controlled.

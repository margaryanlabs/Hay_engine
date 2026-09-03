# HAY Persistent Pronunciation Registry

HAY keeps two deliberately separate pronunciation layers:

1. **Curated core in code** — deterministic, versioned, always available and covered by the release gate.
2. **Persistent registry in the dedicated HAY database** — reviewed system entries plus account/business overrides with provenance and version history.

The database is an enhancement, not a runtime dependency for basic Armenian speech. If Supabase is unavailable or migration 008 is missing, HAY falls back to the curated core instead of degrading to an empty dictionary.

## Runtime precedence

For the same written token, the most specific active layer wins:

`business override → account override → HAY-reviewed system entry → curated core`

A business override is loaded only after HAY verifies that `businesses.owner_id` matches the authenticated account/API-key owner.

The runtime merges the selected layer into `normalizeForSpeech()`. The same merged pronunciation behavior is used by product `/api/normalize`, `/api/pronounce`, HAY Voice and Developer Language API normalize/pronounce routes.

## Data model

Migration `supabase/008_language_registry.sql` creates:

- `pronunciation_entries` — the current version of each persistent pronunciation entry.
- `pronunciation_entry_audit` — append-only JSON snapshots written automatically on every insert/update.

Every update increments `pronunciation_entries.version` inside Postgres before the audit snapshot is written. Application code does not decide the next version number.

Scopes:

- `system` — global HAY-reviewed pronunciation. `owner_id` and `business_id` are null.
- `account` — user-specific override across that account.
- `business` — override for one owned HAY business workspace.

Supported provenance fields include:

- `source_type`
- `source_reference`
- `license_code`
- `consent_reference`
- `notes`
- reviewer / review timestamp fields

## Trust and privacy boundary

`pronunciation_entries` and `pronunciation_entry_audit` are not browser tables. Migration 008 explicitly revokes access from `anon` and normal `authenticated` Data API roles and grants server access to `service_role` only.

Owner-facing HAY routes first authenticate the user, validate business ownership when relevant, then access the registry through the server-only admin client.

Private customer/business pronunciation overrides are **operational configuration, not training data by default**. HAY must not silently promote an account/business entry into the global `system` scope or a training/evaluation dataset. A future promotion workflow must preserve provenance and, where customer material is involved, an explicit permission/consent record.

## System-reviewed entries

Runtime global database entries must satisfy all of these conditions:

- `scope = 'system'`
- `status = 'active'`
- `source_type = 'hay-reviewed'`

This prevents drafts/imports from silently changing every HAY customer's speech.

## Owner Dictionary Console

`/pronunciations` lets an authenticated owner:

- create account-wide overrides;
- create overrides scoped to one owned business;
- store Eastern and Western Armenian spoken forms;
- categorize entries;
- attach source / consent references and notes;
- update an existing written form, producing a new audited version;
- archive an override without deleting its history;
- test the active precedence layer through `/api/pronounce`.

## Quality gate

`npm run quality` includes runtime override regression cases in addition to the existing curated Armenian quality suite. It checks that:

- a runtime override can replace a normal Latin brand;
- Armenian-script entries match with Unicode-safe token boundaries;
- a persistent/runtime override can supersede a curated-core pronunciation.

Database connectivity itself is not required by the deterministic CI quality gate.

## Go-live

1. Create the dedicated HAY Supabase project.
2. Apply migrations through `008_language_registry.sql`.
3. Confirm `/api/setup/status` reports `languageData.pronunciationRegistry = true`.
4. Sign in, create an account override in `/pronunciations`, test it, update it and verify the version increments.
5. Create a business override and verify it affects only the owned selected business.
6. Verify archiving falls back to the next precedence layer.
7. Inspect the audit table from a trusted admin context before importing or reviewing any larger language dataset.

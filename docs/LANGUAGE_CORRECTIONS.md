# HAY language correction flywheel

HAY can capture human Armenian corrections without treating customer content as training data by default.

## Consent model

Every correction records three independent booleans plus a versioned consent statement:

- `consent_product_improvement` — permits human review and promotion into reviewed HAY product data.
- `consent_benchmark` — additionally permits use in controlled benchmark/evaluation sets, but only while product-improvement consent is active.
- `consent_model_training` — additionally permits future targeted model-training use, but only while product-improvement consent is active.

All three controls are off by default in `/corrections`. A correction may be saved privately with every reuse flag disabled.

Withdrawal sets the correction to `withdrawn`, timestamps the withdrawal, withdraws a linked dataset record, and archives a promoted pronunciation entry only when that pronunciation still identifies the withdrawn correction as its current consent source.

## Flow

1. Authenticated owner submits source text and a corrected form.
2. Optional business scope is accepted only after server-side ownership validation.
3. Private submissions remain owner history even when reuse consent is false.
4. Only corrections with active product-improvement consent enter the reviewer queue.
5. Reviewer access requires the authenticated email to appear in server-only `HAY_LANGUAGE_REVIEWER_EMAILS`.
6. Accepted corrections create provenance-tracked `dataset_records` with SHA-256 content hashes and consent metadata.
7. Pronunciation corrections may additionally be promoted into the `hay-reviewed` system pronunciation layer.
8. Correction and dataset mutations create append-only audit snapshots.

## Tables

Migration `009_language_corrections_and_dataset_registry.sql` adds:

- `language_corrections`
- `language_correction_audit`
- `dataset_records`
- `dataset_record_audit`

The tables are not directly available to `anon` or normal `authenticated` Data API roles. Product routes authenticate the owner or reviewer first, then operate through the server-only service role.

## Review safety

Review is claim-based to reduce concurrent reviewer races. A submitted record is first moved into `reviewing` and assigned to the reviewer. Final accept/reject writes require the same reviewer and an unwithdrawn consent state.

Dataset promotion is idempotent by `origin_correction_id`. Pronunciation promotion is linked back to the correction so later withdrawal can remove eligibility without indiscriminately deleting unrelated or newer reviewed data.

## Product surfaces

- `/corrections` — owner correction capture, consent controls, history, withdrawal and reviewer queue when authorized.
- `/pronunciations` — owner/business pronunciation configuration plus curated-core inspection.
- `/api/language/corrections` — authenticated owner capture/history/withdrawal.
- `/api/language/corrections/review` — reviewer-only queue and decisions.
- `/api/setup/status` — migration and reviewer-allowlist diagnostics.

## Non-goal

Saving a correction does not mean HAY may reuse it. Benchmark consent does not imply model-training consent, model-training consent does not imply benchmark consent, and neither can bypass the product-improvement consent required for reviewed-data promotion.

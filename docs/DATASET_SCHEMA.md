# Armenian dataset record schema

HAY Engine should treat every dataset item as a provenance-aware record, not an anonymous text blob.

```json
{
  "id": "uuid",
  "written_form": "BTC-ն $110K ա",
  "display_form": "BTC — $110K",
  "spoken_form": "Բիթքոյնը հարյուր տասը հազար դոլար ա",
  "locale": "hy-AM",
  "dialect": "eastern",
  "style": "casual",
  "domain": "finance",
  "source_type": "curated | licensed | user_correction | public_dataset",
  "source_reference": "...",
  "license": "...",
  "consent": null,
  "review_status": "unreviewed | reviewed | rejected",
  "created_at": "ISO-8601"
}
```

Rules:

1. Never mix unknown-license web text into a commercial training corpus.
2. Keep Eastern and Western Armenian labels explicit.
3. Preserve both original and normalized text.
4. Keep code-switched terms instead of deleting them; they are part of real Armenian usage.
5. Human corrections become training/evaluation data only under explicit product consent.

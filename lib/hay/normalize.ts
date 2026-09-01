import { CODE_SWITCH_DICTIONARY, HYBRID_ARMENIAN_FORMS, PRONUNCIATION_DICTIONARY } from "./dictionary";
import { numberToArmenian } from "./numbers";
import type { Dialect, Locale, NormalizationIssue, NormalizationResult } from "./types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeForSpeech(
  input: string,
  locale: Locale = "hy",
  dialect: Dialect = "eastern",
): NormalizationResult {
  const displayText = input.trim().replace(/\s+/g, " ");
  const issues: NormalizationIssue[] = [];
  let spokenText = displayText;

  if (locale !== "hy") {
    return { displayText, spokenText, locale, dialect, issues };
  }

  spokenText = spokenText.replace(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*([kKmM])?/g, (_, raw, suffix) => {
    const base = Number(raw);
    const multiplier = suffix?.toLowerCase() === "k" ? 1_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
    const value = base * multiplier;
    const spoken = `${numberToArmenian(value)} դոլար`;
    issues.push({ kind: "currency", source: `$${raw}${suffix ?? ""}`, spoken });
    return spoken;
  });

  spokenText = spokenText.replace(/\b([0-9]{1,9})\b/g, (source) => {
    const spoken = numberToArmenian(Number(source));
    issues.push({ kind: "number", source, spoken });
    return spoken;
  });

  for (const [regex, spoken] of HYBRID_ARMENIAN_FORMS) {
    spokenText = spokenText.replace(regex, (source) => {
      issues.push({ kind: "brand", source, spoken });
      return spoken;
    });
  }

  for (const [source, spoken] of Object.entries(PRONUNCIATION_DICTIONARY)) {
    const regex = new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi");
    spokenText = spokenText.replace(regex, (match) => {
      issues.push({ kind: source.length <= 4 ? "acronym" : "brand", source: match, spoken });
      return spoken;
    });
  }

  for (const [regex, spoken] of CODE_SWITCH_DICTIONARY) {
    spokenText = spokenText.replace(regex, (source) => {
      issues.push({ kind: "code-switch", source, spoken });
      return spoken;
    });
  }

  spokenText = spokenText
    .replace(/%/g, " տոկոս")
    .replace(/\s+/g, " ")
    .trim();

  return { displayText, spokenText, locale, dialect, issues };
}

import { CODE_SWITCH_DICTIONARY, HYBRID_ARMENIAN_FORMS, PRONUNCIATION_DICTIONARY } from "./dictionary";
import { numberToArmenian } from "./numbers";
import type { Dialect, Locale, NormalizationIssue, NormalizationResult } from "./types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenRegex(value:string){
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`,"giu");
}

function numericValue(raw:string){
  return Number(raw.replace(/[\s,]/g,""));
}

function moneySpoken(raw:string,currency:string){
  const value=numericValue(raw);
  return Number.isFinite(value)?`${numberToArmenian(value)} ${currency}`:null;
}

export function normalizeForSpeech(
  input: string,
  locale: Locale = "hy",
  dialect: Dialect = "eastern",
  pronunciationOverrides: Record<string,string> = {},
): NormalizationResult {
  const displayText = input.trim().replace(/\s+/g, " ");
  const issues: NormalizationIssue[] = [];
  let spokenText = displayText;

  if (locale !== "hy") {
    return { displayText, spokenText, locale, dialect, issues };
  }

  // Armenian commerce most often displays prices as `14,900 ֏` or `14900 AMD`.
  // Normalize the full token before the generic number pass so TTS never says a comma
  // or leaves the dram sign hanging after a spoken number.
  const groupedNumber="[0-9]{1,3}(?:[ ,][0-9]{3})+|[0-9]+";
  const replaceCurrency=(pattern:RegExp,currency:string)=>{
    spokenText=spokenText.replace(pattern,(source:string,raw:string)=>{
      const spoken=moneySpoken(raw,currency);
      if(!spoken)return source;
      issues.push({kind:"currency",source,spoken});
      return spoken;
    });
  };

  replaceCurrency(new RegExp(`(${groupedNumber})\\s*(?:֏|AMD\\b)`,"giu"),"դրամ");
  replaceCurrency(new RegExp(`(?:֏|AMD\\b)\\s*(${groupedNumber})`,"giu"),"դրամ");
  replaceCurrency(new RegExp(`(${groupedNumber})\\s*(?:€|EUR\\b)`,"giu"),"եվրո");
  replaceCurrency(new RegExp(`(?:€|EUR\\b)\\s*(${groupedNumber})`,"giu"),"եվրո");
  replaceCurrency(new RegExp(`(${groupedNumber})\\s*(?:₾|GEL\\b)`,"giu"),"լարի");
  replaceCurrency(new RegExp(`(?:₾|GEL\\b)\\s*(${groupedNumber})`,"giu"),"լարի");

  // A comma in a dollar token is treated as a thousands separator; a dot is decimal.
  // This keeps `$14,900` distinct from `$14.9` while preserving `$115.5K` exactly.
  spokenText = spokenText.replace(/\$\s*((?:[0-9]{1,3}(?:,[0-9]{3})+)|(?:[0-9]+(?:\.[0-9]+)?))\s*([kKmM])?/g, (source, raw, suffix) => {
    const base = numericValue(String(raw));
    const multiplier = suffix?.toLowerCase() === "k" ? 1_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
    const value = base * multiplier;
    if(!Number.isFinite(value))return source;
    const spoken = `${numberToArmenian(value)} դոլար`;
    issues.push({ kind: "currency", source, spoken });
    return spoken;
  });

  // Read thousands-grouped non-currency numbers as one number, not `14` then `900`.
  spokenText = spokenText.replace(/\b([0-9]{1,3}(?:,[0-9]{3})+)\b/g, (source) => {
    const value=numericValue(source);
    const spoken=numberToArmenian(value);
    issues.push({kind:"number",source,spoken});
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

  const pronunciationDictionary:Record<string,string>={...PRONUNCIATION_DICTIONARY};
  for(const [source,spoken] of Object.entries(pronunciationOverrides)){
    const key=source.trim().toLocaleUpperCase("en-US");
    if(key&&spoken.trim())pronunciationDictionary[key]=spoken.trim();
  }
  for (const [source, spoken] of Object.entries(pronunciationDictionary)) {
    const regex = tokenRegex(source);
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

export const HAY_PROTECTED_TOKEN_PATTERN = /(?:\$|€|₾|֏)?\d[\d,]*(?:\.\d+)?%?|https?:\/\/\S+|\b[A-Za-z][A-Za-z0-9._+-]*(?:[-/][A-Za-z0-9._+-]+)*\b/g;

export function cleanLanguageText(text:string){
  return text
    .trim()
    .replace(/\s+/g," ")
    .replace(/\s+([,։.!?՝՜՞:;])/gu,"$1")
    .replace(/([,։.!?])(?=\p{L})/gu,"$1 ")
    .trim();
}

export function extractProtectedTokens(text:string){
  return [...text.matchAll(HAY_PROTECTED_TOKEN_PATTERN)].map(match=>match[0]);
}

export function preservesProtectedTokens(source:string,candidate:string){
  const lower=candidate.toLocaleLowerCase("en-US");
  return extractProtectedTokens(source).every(token=>lower.includes(token.toLocaleLowerCase("en-US")));
}

export function protectedValueReport(source:string,candidate:string){
  const expected=extractProtectedTokens(source);
  const lower=candidate.toLocaleLowerCase("en-US");
  const missing=expected.filter(token=>!lower.includes(token.toLocaleLowerCase("en-US")));
  return {expected,missing,passed:missing.length===0};
}

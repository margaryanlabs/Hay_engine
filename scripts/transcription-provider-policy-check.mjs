import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

const google=read("lib/providers/google-chirp3-transcription.ts");
assert.match(google,/import "server-only"/,"Google Speech credentials must remain server-only");
assert.doesNotMatch(google,/NEXT_PUBLIC_GOOGLE/,"Google Speech credentials must never be exposed through NEXT_PUBLIC env names");
assert.match(google,/GOOGLE_CLOUD_SPEECH_CLIENT_EMAIL/,"Chirp 3 must use a server-side service account identity");
assert.match(google,/GOOGLE_CLOUD_SPEECH_PRIVATE_KEY/,"Chirp 3 must use a server-side service account private key");
assert.match(google,/https:\/\/oauth2\.googleapis\.com\/token/,"Chirp 3 adapter must obtain an OAuth access token through Google's token endpoint");
assert.match(google,/https:\/\/www\.googleapis\.com\/auth\/cloud-platform/,"Chirp 3 OAuth token must be scoped to cloud-platform");
assert.match(google,/value === "eu" \? "eu" : "us"/,"Armenian Chirp 3 routing must stay within the supported us/eu multi-regions");
assert.match(google,/model: "chirp_3"/,"Google STT adapter must explicitly request Chirp 3");
assert.match(google,/autoDecodingConfig: \{\}/,"Chirp 3 adapter must use V2 automatic audio decoding");
assert.match(google,/10 \* 1024 \* 1024/,"Synchronous Chirp 3 inline audio must keep the documented 10 MB bound");
assert.match(google,/recognizers\/_:recognize/,"Chirp 3 adapter must use Speech-to-Text V2 synchronous Recognize");

const router=read("lib/providers/transcription.ts");
assert.match(router,/HAY_TRANSCRIPTION_PROVIDER \|\| "openai"/,"OpenAI must remain the default provider until benchmark evidence changes the routing policy");
assert.match(router,/normalized === "hy" \|\| normalized === "hy-am"/,"Auto routing must recognize Armenian explicitly");
assert.match(router,/isGoogleChirp3TranscriptionConfigured\(\)[\s\S]*?return "google-chirp3"/,"Auto routing may prefer configured Chirp 3 for Armenian");
assert.match(router,/transcribeWithGoogleChirp3/,"Provider router must call the Google adapter only through the centralized boundary");
assert.match(router,/transcribeWithOpenAI/,"Provider router must preserve the OpenAI adapter");

for(const path of ["app/api/transcribe/route.ts","app/api/v1/language/transcribe/route.ts"]){
  const route=read(path);
  assert.match(route,/resolveTranscriptionProvider\(/,`${path} must resolve the selected STT provider before provider work`);
  assert.match(route,/transcribeWithConfiguredProvider\(/,`${path} must call STT through the centralized provider router`);
  assert.doesNotMatch(route,/transcribeWithOpenAI\(/,`${path} must not bypass the provider router with a direct OpenAI call`);
  assert.match(route,/GOOGLE_SYNC_MAX_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/,`${path} must enforce the synchronous Chirp 3 inline payload bound`);
}

const setup=read("app/api/setup/status/route.ts");
assert.match(setup,/transcriptionProviderReadiness\(\)/,"Operator diagnostics must expose STT provider readiness");
assert.match(setup,/isAnyTranscriptionProviderConfigured\(\)/,"Overall transcription readiness must accept either configured provider");
assert.doesNotMatch(setup,/openai_key_required_for_transcription/,"Setup diagnostics must not falsely require OpenAI when Chirp 3 is configured");

const env=read(".env.example");
for(const variable of ["HAY_TRANSCRIPTION_PROVIDER","GOOGLE_CLOUD_PROJECT","GOOGLE_CLOUD_SPEECH_CLIENT_EMAIL","GOOGLE_CLOUD_SPEECH_PRIVATE_KEY","GOOGLE_CLOUD_SPEECH_LOCATION"]){
  assert.match(env,new RegExp(`^${variable}=`,`m`),`${variable} must be documented for Vercel/operator setup`);
}

console.log(JSON.stringify({
  transcriptionProviderPolicy:"passed",
  providers:["openai","google-chirp3"],
  defaultProvider:"openai",
  armenianAutoRouting:true,
  chirp3Locale:"hy-AM",
  chirp3Locations:["us","eu"],
  chirp3SyncInlineMaxBytes:10*1024*1024,
  centralizedProviderBoundary:true,
},null,2));

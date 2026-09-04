import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout=readFileSync("app/layout.tsx","utf8");
const home=readFileSync("app/page.tsx","utf8");
const landing=readFileSync("components/LandingPageV7.tsx","utf8");
const landingCss=readFileSync("app/landing-v7.css","utf8");
const redesign=readFileSync("app/redesign-v7.css","utf8");
const studio=readFileSync("components/MarketingOSV7.tsx","utf8");
const login=readFileSync("components/LoginForm.tsx","utf8");
const commercial=readFileSync("components/StudioCommercialRail.tsx","utf8");
const onboarding=readFileSync("components/StudioOnboarding.tsx","utf8");
const publish=readFileSync("components/PublishDialog.tsx","utf8");
const socialIcon=readFileSync("components/SocialBrandIcon.tsx","utf8");

assert.doesNotMatch(layout,/import\s+["']\.\/marketing-v2\.css["']/,"Retired neon Marketing OS skin must stay out of the product shell");
for(const required of ["./redesign-v7.css","./redesign-v7-labs.css","./landing-v7.css","./studio-v7-refine.css"]){
  assert.ok(layout.includes(`import "${required}"`),`V7 layer ${required} must remain loaded`);
}
const legacyBridgeIndex=layout.indexOf('import "./product-ui-legacy.css"');
const redesignIndex=layout.indexOf('import "./redesign-v7.css"');
const landingIndex=layout.indexOf('import "./landing-v7.css"');
assert.ok(legacyBridgeIndex>=0&&redesignIndex>legacyBridgeIndex&&landingIndex>redesignIndex,"V7 styles must load after legacy compatibility styles");
assert.match(home,/LandingPageV7/,"Public home page must render Landing V7");
assert.doesNotMatch(home,/LandingPageV[1-6]/,"Public home page must not regress to a retired landing generation");

assert.match(redesign,/--hay-bg:\s*#f4f4f0/,"V7 must expose the warm light background token");
assert.match(redesign,/--hay-accent:\s*#5b55e7/,"V7 must expose the controlled indigo accent");
assert.match(redesign,/--hay-positive:\s*#247b59/,"Green must remain reserved for semantic positive states");
assert.doesNotMatch(landingCss,/#9fff57|#d9ff63|#39ff14/i,"Landing V7 must not contain retired acid/neon accents");
assert.match(landingCss,/\.hayLandingV7/,"Landing V7 must own a dedicated surface");
assert.match(landingCss,/\.hv7Cockpit/,"Landing hero must show a product/workspace preview rather than an abstract-only hero");

assert.ok(landing.includes('import SocialBrandIcon from "./SocialBrandIcon"'),"Landing V7 must use shared social brand icons");
for(const platform of ["instagram","tiktok","youtube","facebook"]){
  assert.ok(landing.includes(`platform: "${platform}"`),`Landing V7 must include ${platform}`);
}
assert.ok(landing.includes("WORKSPACE PREVIEW"),"Homepage example must be explicitly presented as a preview rather than fake live data");
assert.doesNotMatch(landing,/AI MARKETING OPERATING SYSTEM|AI BRAIN|\/ CONNECTED/,"Homepage must not regress to generic AI-dashboard copy or fake connection claims");
assert.ok(landing.includes('href="/voice"'),"Armenian product layer must link to Voice");
assert.ok(landing.includes('href="/language"'),"Armenian product layer must link to Language");
assert.ok(landing.includes('href="/quality"'),"Armenian product layer must link to Quality");

assert.ok(studio.includes("const emptyBusiness: BusinessProfile"),"Real first-run Studio must have an empty business profile");
assert.ok(studio.includes("const sampleBusiness: BusinessProfile"),"Sample data must be isolated from real first-run data");
assert.match(studio,/data\.configured===false[\s\S]*?setWorkspaceMode\("preview"\)[\s\S]*?setBusiness\(sampleBusiness\)/,"Sample business must only be activated in preview mode");
assert.ok(studio.includes('disabled={busy||workspaceMode==="loading"||!canRun}'),"Primary Studio actions must stay blocked until minimum business context exists");
assert.ok(studio.includes('body:JSON.stringify({business,businessId:effectiveBusinessId,competitors})'),"Business analysis must retain the selected workspace id");
assert.ok(studio.includes("selectBusinessWorkspace(id,false)"),"Saved business context must synchronize the active workspace");
assert.doesNotMatch(studio,/orbitPanel|AI BRAIN|AI MARKETING OPERATING SYSTEM/,"Studio V7 must not restore retired sci-fi/AI-dashboard treatments");
assert.ok(studio.includes("<SocialBrandIcon platform={platform}"),"Channel connector rows must render shared platform marks");
assert.ok(studio.includes("<SocialBrandIcon platform={item.platform}"),"Content tiles must render shared platform marks");

assert.ok(onboarding.includes("PREVIEW MODE"),"Onboarding must describe non-persistent exploration as preview mode");
assert.doesNotMatch(onboarding,/Supabase|BUSINESS \$\{businessId|DEMO MODE/,"Onboarding must not expose infrastructure names, internal ids, or old demo language");
assert.ok(onboarding.includes('title:"Business context"'),"First-run flow must begin with business context");
assert.ok(onboarding.includes('title:"Build the first 7 days"'),"First-run flow must lead to the first useful marketing cycle");

assert.ok(login.includes("const allowedPlans=new Set"),"Login must validate plan handoff values");
assert.ok(login.includes('target.searchParams.set("plan",plan)'),"Selected pricing plan must survive secure sign-in");
assert.ok(commercial.includes("function clearRequestedPlan()"),"Studio billing flow must clear one-shot plan requests");
assert.match(commercial,/clearRequestedPlan\(\);\s*window\.location\.assign\(data\.checkoutUrl\)/,"Checkout handoff must clear plan state before leaving Studio to avoid browser-back loops");

assert.ok(publish.includes("<SocialBrandIcon platform={item.platform}"),"Publish review must identify the selected platform visually");
assert.ok(publish.includes('<SocialBrandIcon platform="tiktok"'),"TikTok controls must carry the TikTok mark");
for(const platform of ["instagram","tiktok","youtube","facebook","linkedin"]){
  assert.ok(socialIcon.includes(`${platform}: "`),`SocialBrandIcon must define ${platform}`);
}
assert.ok(socialIcon.includes("socialBrandTikTokLayer cyan"),"TikTok mark must preserve its cyan offset");
assert.ok(socialIcon.includes("socialBrandTikTokLayer pink"),"TikTok mark must preserve its pink offset");

console.log(JSON.stringify({
  uiContract:"passed",
  landingVersion:"v7",
  firstRunSampleIsolation:true,
  selectedPlanHandoff:true,
  checkoutBackLoopProtected:true,
  retiredNeonSkinLoaded:false,
  unifiedSurfaces:["landing","login","studio","creator","voice","language","publish"],
  socialBrandIcons:["instagram","tiktok","youtube","facebook","linkedin"],
  semanticGreenOnly:true,
},null,2));

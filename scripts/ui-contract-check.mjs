import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("app/layout.tsx", "utf8");
const theme = readFileSync("app/product-ui.css", "utf8");
const legacyTheme = readFileSync("app/product-ui-legacy.css", "utf8");
const marketing = readFileSync("components/MarketingOS.tsx", "utf8");
const publish = readFileSync("components/PublishDialog.tsx", "utf8");
const socialIcon = readFileSync("components/SocialBrandIcon.tsx", "utf8");

assert.doesNotMatch(
  layout,
  /import\s+["']\.\/marketing-v2\.css["']/,
  "The retired neon Marketing OS skin must never be loaded into the product shell",
);

const productThemeIndex = layout.indexOf('import "./product-ui.css"');
const legacyBridgeIndex = layout.indexOf('import "./product-ui-legacy.css"');
const loginIndex = layout.indexOf('import "./login.css"');
assert.ok(
  loginIndex >= 0 && productThemeIndex > loginIndex && legacyBridgeIndex > productThemeIndex,
  "Unified HAY product themes must load after legacy page styles",
);

assert.match(theme, /--hay-bg:#08090b/, "Unified HAY theme must expose the graphite background token");
assert.match(theme, /--hay-accent:#da8d80/, "Unified HAY theme must expose the coral product accent");
assert.match(theme, /--hay-blue:#aebfe1/, "Unified HAY theme must expose the intelligence/data blue token");
assert.match(theme, /--hay-success:#91b58d/, "Unified HAY theme must reserve green for semantic success states");
assert.match(theme, /\.marketingPage\{[\s\S]*?--m-warm:var\(--hay-accent\)/, "Marketing OS must inherit the same HAY product accent as Landing");
assert.match(theme, /\.loginPage\{background:var\(--hay-bg\)/, "Login must remain inside the HAY product visual system");
assert.match(theme, /\.creatorMessage\{/, "Creator must receive unified product chrome overrides");

assert.match(
  legacyTheme,
  /--green:var\(--hay-accent\)!important/,
  "Legacy Studio modules must not be able to restore the neon primary accent",
);
assert.match(
  legacyTheme,
  /\.connectionLed\.ready,[\s\S]*?background:var\(--hay-success\)!important/,
  "Connected channel state must remain semantic green rather than product-accent green",
);

assert.match(marketing, /import SocialBrandIcon from "\.\/SocialBrandIcon"/, "Marketing OS must use shared social brand icons");
assert.doesNotMatch(marketing, /code:\s*"(?:IG|TT|YT|FB)"/, "Social channel buttons must not regress to letter abbreviations");
assert.match(marketing, /<SocialBrandIcon platform=\{platform\}/, "Channel connector rows must render official platform marks");
assert.match(marketing, /<SocialBrandIcon platform=\{item\.platform\}/, "Content tiles must render platform marks");
assert.match(marketing, /href="\/voice"/, "Studio navigation must link to Voice rather than rendering dead text");
assert.match(marketing, /href="\/developers"/, "Studio navigation must link to the developer/language surface rather than rendering dead text");

assert.match(publish, /<SocialBrandIcon platform=\{item\.platform\}/, "Publish review must identify the selected platform visually");
assert.match(publish, /<SocialBrandIcon platform="tiktok"/, "TikTok Direct Post controls must carry the TikTok mark");

for (const platform of ["instagram", "tiktok", "youtube", "facebook", "linkedin"]) {
  assert.match(socialIcon, new RegExp(`${platform}:\\s*"`), `SocialBrandIcon must define ${platform}`);
}
assert.match(socialIcon, /socialBrandTikTokLayer cyan/, "TikTok mark must preserve its cyan brand offset");
assert.match(socialIcon, /socialBrandTikTokLayer pink/, "TikTok mark must preserve its pink brand offset");

console.log(JSON.stringify({
  uiContract: "passed",
  neonMarketingSkinLoaded: false,
  unifiedSurfaces: ["landing", "login", "studio", "creator", "publish"],
  socialBrandIcons: ["instagram", "tiktok", "youtube", "facebook", "linkedin"],
  semanticGreenOnly: true,
}, null, 2));

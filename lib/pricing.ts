export type HayPlan = {
  id: "free" | "creator" | "growth" | "business";
  name: string;
  priceAmd: number;
  monthly: boolean;
  badge?: string;
  description: { hy: string; en: string; ru: string };
  features: { hy: string[]; en: string[]; ru: string[] };
  limits: {
    brands: number;
    channels: number;
    contentAssets: number;
    aiVideoCredits: number;
    voiceMinutes: number;
  };
};

export const HAY_PLANS: HayPlan[] = [
  {
    id: "free",
    name: "Free",
    priceAmd: 0,
    monthly: true,
    description: {
      hy: "Փորձիր HAY-ը մեկ բիզնեսի համար և կառուցիր առաջին կոնտենտային շաբաթը։",
      en: "Try HAY for one business and build your first content week.",
      ru: "Попробуйте HAY для одного бизнеса и соберите первую контент-неделю.",
    },
    features: {
      hy: ["1 բիզնես", "2 սոցիալական ալիք", "12 կոնտենտ գաղափար / ամիս", "Հայերեն ռազմավարություն ու copy", "1 AI video փորձարկում"],
      en: ["1 business", "2 social channels", "12 content ideas / month", "Armenian strategy & copy", "1 AI video trial"],
      ru: ["1 бизнес", "2 соцсети", "12 контент-идей / месяц", "Армянская стратегия и copy", "1 пробное AI-видео"],
    },
    limits: { brands: 1, channels: 2, contentAssets: 12, aiVideoCredits: 1, voiceMinutes: 5 },
  },
  {
    id: "creator",
    name: "Creator",
    priceAmd: 14900,
    monthly: true,
    description: {
      hy: "Բլոգերների, փոքր բիզնեսների և founder-led բրենդների համար։",
      en: "For creators, small businesses and founder-led brands.",
      ru: "Для блогеров, малого бизнеса и founder-led брендов.",
    },
    features: {
      hy: ["1 բրենդ", "4 սոցիալական ալիք", "40 կոնտենտ asset / ամիս", "6 AI video credit", "30 րոպե հայկական ձայն", "Schedule + analytics"],
      en: ["1 brand", "4 social channels", "40 content assets / month", "6 AI video credits", "30 min Armenian voice", "Schedule + analytics"],
      ru: ["1 бренд", "4 соцсети", "40 контент-ассетов / месяц", "6 AI video credits", "30 минут армянского голоса", "Schedule + analytics"],
    },
    limits: { brands: 1, channels: 4, contentAssets: 40, aiVideoCredits: 6, voiceMinutes: 30 },
  },
  {
    id: "growth",
    name: "Growth",
    priceAmd: 39900,
    monthly: true,
    badge: "MOST POPULAR",
    description: {
      hy: "Ռեստորանների, հյուրանոցների, խանութների և աճող թիմերի համար։",
      en: "For restaurants, hotels, retail and growing teams.",
      ru: "Для ресторанов, отелей, retail и растущих команд.",
    },
    features: {
      hy: ["2 բրենդ", "6 սոցիալական ալիք", "100 կոնտենտ asset / ամիս", "20 AI video credit", "120 րոպե հայկական ձայն", "Autopilot + competitor radar", "Learn loop + performance memory"],
      en: ["2 brands", "6 social channels", "100 content assets / month", "20 AI video credits", "120 min Armenian voice", "Autopilot + competitor radar", "Learn loop + performance memory"],
      ru: ["2 бренда", "6 соцсетей", "100 контент-ассетов / месяц", "20 AI video credits", "120 минут армянского голоса", "Autopilot + competitor radar", "Learn loop + performance memory"],
    },
    limits: { brands: 2, channels: 6, contentAssets: 100, aiVideoCredits: 20, voiceMinutes: 120 },
  },
  {
    id: "business",
    name: "Business",
    priceAmd: 99000,
    monthly: true,
    description: {
      hy: "Մի քանի լոկացիա, թիմային approval և մեծ կոնտենտային հոսք ունեցող բիզնեսների համար։",
      en: "For multi-location businesses with teams, approvals and high content volume.",
      ru: "Для сетевых бизнесов с командами, approval-flow и большим объёмом контента.",
    },
    features: {
      hy: ["5 բրենդ / լոկացիա", "12 սոցիալական ալիք", "300 կոնտենտ asset / ամիս", "50 AI video credit", "500 րոպե հայկական ձայն", "Team approvals + roles", "Priority render/publish", "API & integrations"],
      en: ["5 brands / locations", "12 social channels", "300 content assets / month", "50 AI video credits", "500 min Armenian voice", "Team approvals + roles", "Priority render/publish", "API & integrations"],
      ru: ["5 брендов / локаций", "12 соцсетей", "300 контент-ассетов / месяц", "50 AI video credits", "500 минут армянского голоса", "Командные approvals + роли", "Priority render/publish", "API и интеграции"],
    },
    limits: { brands: 5, channels: 12, contentAssets: 300, aiVideoCredits: 50, voiceMinutes: 500 },
  },
];

export const AGENCY_STARTING_AMD = 199000;

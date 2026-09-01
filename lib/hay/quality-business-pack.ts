import type { ArmenianQualityCase } from "./quality-benchmark";

export const ARMENIAN_BUSINESS_QUALITY_PACK: ArmenianQualityCase[] = [
  // Tourism / hotels — natural Armenian
  {id:"nat2-001",domain:"tourism",kind:"naturalization",style:"natural",input:"Ներկայումս կարող եք ամրագրել քաղաքային տուրը մեր կայքում։",mustInclude:["հիմա"],mustExclude:["Ներկայումս"],note:"Tour booking copy should start naturally."},
  {id:"nat2-002",domain:"tourism",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք փոխել ամրագրման օրը, անհրաժեշտ է գրել մեզ։",mustInclude:["ուզում եք","պետք է"],mustExclude:["ցանկանում եք","անհրաժեշտ է"],note:"Booking-change instructions should sound conversational."},
  {id:"nat2-003",domain:"tourism",kind:"naturalization",style:"natural",input:"Այնուհետև կարող եք ընտրել հյուրանոցի սենյակը։",mustInclude:["հետո"],mustExclude:["Այնուհետև"],note:"Travel flow narration should avoid formal sequencing."},
  {id:"nat2-004",domain:"tourism",kind:"naturalization",style:"natural",input:"Հնարավորություն ունեք չեղարկել ամրագրումը մինչև երեկո։",mustInclude:["կարող եք"],mustExclude:["Հնարավորություն ունեք"],note:"Cancellation copy should be direct."},
  {id:"nat2-005",domain:"tourism",kind:"naturalization",style:"yerevan",input:"Այս դեպքում այո, այս մեկը ավելի հարմար տարբերակ է։",mustInclude:["էս դեպքում","հա","էս մեկը"],note:"Yerevan travel concierge mode."},

  // Automotive — natural Armenian
  {id:"nat2-006",domain:"automotive",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք ձեռք բերել այս մեքենան, կարող եք գրել մեզ։",mustInclude:["ուզում եք","գնել"],mustExclude:["ցանկանում եք","ձեռք բերել"],note:"Dealer CTA should use simple purchase language."},
  {id:"nat2-007",domain:"automotive",kind:"naturalization",style:"natural",input:"Ներկայումս իրականացնում ենք մեքենայի test drive-ը։",mustInclude:["հիմա","անում ենք"],mustExclude:["Ներկայումս","իրականացնում ենք"],preserve:["test drive"],note:"Dealer narration should simplify Armenian while preserving common imported terms."},
  {id:"nat2-008",domain:"automotive",kind:"naturalization",style:"natural",input:"Ամրագրելու համար անհրաժեշտ է կատարել վճարում։",mustInclude:["պետք է","վճարել"],mustExclude:["անհրաժեշտ է","կատարել վճարում"],note:"Reservation/deposit instruction."},
  {id:"nat2-009",domain:"automotive",kind:"naturalization",style:"natural",input:"Հնարավորություն ունեք փոխել մեքենան մինչև պայմանագրի հաստատումը։",mustInclude:["կարող եք"],mustExclude:["Հնարավորություն ունեք"],note:"Dealer support copy."},
  {id:"nat2-010",domain:"automotive",kind:"naturalization",style:"yerevan",input:"Այդ դեպքում այս մեկը կարող եք տեսնել այսօր։",mustInclude:["էդ դեպքում","էս մեկը"],note:"Mild Yerevan dealer speech."},

  // Healthcare — natural Armenian
  {id:"nat2-011",domain:"healthcare",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք ամրագրել այց, անհրաժեշտ է ընտրել բժշկին։",mustInclude:["ուզում եք","պետք է"],mustExclude:["ցանկանում եք","անհրաժեշտ է"],note:"Appointment copy should be clear without changing medical meaning."},
  {id:"nat2-012",domain:"healthcare",kind:"naturalization",style:"natural",input:"Ներկայումս իրականացնում ենք նախնական խորհրդատվություն։",mustInclude:["հիմա","անում ենք"],mustExclude:["Ներկայումս","իրականացնում ենք"],note:"Clinic service description should sound spoken."},
  {id:"nat2-013",domain:"healthcare",kind:"naturalization",style:"natural",input:"Տվյալ դեպքում անհրաժեշտ է կապվել կլինիկայի հետ։",mustInclude:["այս դեպքում","պետք է"],mustExclude:["Տվյալ դեպքում","անհրաժեշտ է"],note:"Clinic support instruction."},
  {id:"nat2-014",domain:"healthcare",kind:"naturalization",style:"natural",input:"Հնարավորություն ունեք փոխել այցի ժամը մինչև մեկ օր առաջ։",mustInclude:["կարող եք"],mustExclude:["Հնարավորություն ունեք"],note:"Appointment rescheduling copy."},
  {id:"nat2-015",domain:"healthcare",kind:"naturalization",style:"standard",input:"Ներկայումս կլինիկան աշխատում է մինչև ժամը 20։",mustInclude:["Ներկայումս"],preserve:["20"],note:"Medical standard mode must remain formal and exact."},

  // Education — natural Armenian
  {id:"nat2-016",domain:"education",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք գրանցվել դասընթացին, անհրաժեշտ է լրացնել հայտը։",mustInclude:["ուզում եք","պետք է"],mustExclude:["ցանկանում եք","անհրաժեշտ է"],note:"Course registration should sound accessible."},
  {id:"nat2-017",domain:"education",kind:"naturalization",style:"natural",input:"Ներկայումս իրականացնում ենք դասընթացը երկու ձևաչափով։",mustInclude:["հիմա","անում ենք"],mustExclude:["Ներկայումս","իրականացնում ենք"],note:"Education marketing narration."},
  {id:"nat2-018",domain:"education",kind:"naturalization",style:"natural",input:"Գրանցումն ավարտելու համար անհրաժեշտ է կատարել վճարում։",mustInclude:["պետք է","վճարել"],mustExclude:["անհրաժեշտ է","կատարել վճարում"],note:"Course checkout copy."},
  {id:"nat2-019",domain:"education",kind:"naturalization",style:"natural",input:"Հնարավորություն ունեք դիտել առաջին դասը անվճար։",mustInclude:["կարող եք"],mustExclude:["Հնարավորություն ունեք"],note:"Trial lesson CTA."},
  {id:"nat2-020",domain:"education",kind:"naturalization",style:"yerevan",input:"Այո, այսպես կարող եք դասը բացել հեռախոսից։",mustInclude:["հա","էսպես"],note:"Casual learning-product explanation."},

  // Banking / fintech — natural Armenian
  {id:"nat2-021",domain:"banking",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք բացել հաշիվ, անհրաժեշտ է հաստատել ձեր տվյալները։",mustInclude:["ուզում եք","պետք է"],mustExclude:["ցանկանում եք","անհրաժեշտ է"],note:"Account-opening instructions should remain clear and formal enough."},
  {id:"nat2-022",domain:"banking",kind:"naturalization",style:"natural",input:"Ներկայումս իրականացնում ենք փոխանցումը։",mustInclude:["հիմա","անում ենք"],mustExclude:["Ներկայումս","իրականացնում ենք"],note:"Transaction status narration."},
  {id:"nat2-023",domain:"banking",kind:"naturalization",style:"natural",input:"Հնարավորություն ունեք կատարել վճարում նաև հավելվածից։",mustInclude:["կարող եք","վճարել"],mustExclude:["Հնարավորություն ունեք","կատարել վճարում"],note:"Digital banking action copy."},
  {id:"nat2-024",domain:"banking",kind:"naturalization",style:"natural",input:"Տվյալ դեպքում անհրաժեշտ է կրկին հաստատել գործողությունը։",mustInclude:["այս դեպքում","պետք է"],mustExclude:["Տվյալ դեպքում","անհրաժեշտ է"],note:"Banking support flow."},
  {id:"nat2-025",domain:"banking",kind:"naturalization",style:"standard",input:"Ներկայումս փոխանցման կարգավիճակը սպասման մեջ է։",mustInclude:["Ներկայումս"],note:"Standard financial copy remains unchanged."},

  // Tourism / hotels — speech
  {id:"sp2-001",domain:"tourism",kind:"speech",input:"Սենյակի արժեքը $85 է։",mustInclude:["ութսունհինգ դոլար"],note:"Hotel room USD price."},
  {id:"sp2-002",domain:"tourism",kind:"speech",input:"Տուրը նախատեսված է 12 հյուրի համար։",mustInclude:["տասներկու"],note:"Tour group size."},
  {id:"sp2-003",domain:"tourism",kind:"speech",input:"Հյուրանոցում Wi-Fi և QR կոդ կա։",mustInclude:["վայ ֆայ","Քյու Ար"],note:"Hotel connectivity and QR terminology."},
  {id:"sp2-004",domain:"tourism",kind:"speech",input:"Այս շաբաթ գործում է 20% զեղչ։",mustInclude:["քսան","տոկոս"],note:"Travel promotion percentage."},
  {id:"sp2-005",domain:"tourism",kind:"speech",input:"2026 թվականին սպասում ենք 3 նոր տուրի։",mustInclude:["երկու հազար քսանվեց","երեք"],note:"Tourism year and count."},

  // Automotive — speech
  {id:"sp2-006",domain:"automotive",kind:"speech",input:"VIN կոդը նշված է հայտարարության մեջ։",mustInclude:["Վին"],note:"Vehicle VIN pronunciation."},
  {id:"sp2-007",domain:"automotive",kind:"speech",input:"Այս SUV-ը նաև EV տարբերակ ունի։",mustInclude:["Էս Յու Վի","Ի Վի"],note:"Common vehicle categories."},
  {id:"sp2-008",domain:"automotive",kind:"speech",input:"Մեքենայի գինը $25K է։",mustInclude:["քսանհինգ հազար դոլար"],note:"Compact automotive USD price."},
  {id:"sp2-009",domain:"automotive",kind:"speech",input:"2024 թվականի 3 մեքենա կա պահեստում։",mustInclude:["երկու հազար քսանչորս","երեք"],note:"Model year and inventory count."},
  {id:"sp2-010",domain:"automotive",kind:"speech",input:"Կանխավճարը 14900 AMD է։",mustInclude:["տասնչորս հազար ինը հարյուր","դրամ"],note:"Dealer deposit in Armenian dram."},

  // Healthcare — speech
  {id:"sp2-011",domain:"healthcare",kind:"speech",input:"Այցի հաստատումը կստանաք SMS հաղորդագրությամբ։",mustInclude:["Էս Էմ Էս"],note:"Clinic SMS confirmation."},
  {id:"sp2-012",domain:"healthcare",kind:"speech",input:"QR կոդը բացում է այցի տվյալները։",mustInclude:["Քյու Ար"],note:"Clinic QR workflow."},
  {id:"sp2-013",domain:"healthcare",kind:"speech",input:"Խորհրդատվությունը տևում է 15 րոպե։",mustInclude:["տասնհինգ"],note:"Appointment duration."},
  {id:"sp2-014",domain:"healthcare",kind:"speech",input:"Այցի արժեքը 12000 AMD է։",mustInclude:["տասներկու հազար","դրամ"],note:"Clinic price in AMD."},
  {id:"sp2-015",domain:"healthcare",kind:"speech",input:"Այս ամսվա համար ունենք 2 ազատ այց։",mustInclude:["երկու"],note:"Appointment availability count."},

  // Education — speech
  {id:"sp2-016",domain:"education",kind:"speech",input:"IELTS դասի PDF նյութերը հասանելի են։",mustInclude:["Այելթս","Փի Դի Էֆ"],note:"Education exam and document terminology."},
  {id:"sp2-017",domain:"education",kind:"speech",input:"Դասընթացը հասանելի է 3 լեզվով։",mustInclude:["երեք"],note:"Course language count."},
  {id:"sp2-018",domain:"education",kind:"speech",input:"Ամսական արժեքը $29 է։",mustInclude:["քսանինը դոլար"],note:"Course subscription price."},
  {id:"sp2-019",domain:"education",kind:"speech",input:"2026 թվականին բացվում է 5 նոր խումբ։",mustInclude:["երկու հազար քսանվեց","հինգ"],note:"Academic year and cohort count."},
  {id:"sp2-020",domain:"education",kind:"speech",input:"CRM համակարգում պահվում է 2 դասընթացի հայտ։",mustInclude:["Սի Ար Էմ","երկու"],note:"Education CRM workflow."},

  // Banking / fintech — speech
  {id:"sp2-021",domain:"banking",kind:"speech",input:"IBAN համարը ուղարկվել է SMS հաղորդագրությամբ։",mustInclude:["Այբան","Էս Էմ Էս"],note:"Banking identifiers and SMS."},
  {id:"sp2-022",domain:"banking",kind:"speech",input:"OTP կոդը գործում է 2 րոպե։",mustInclude:["Օ Թի Փի","երկու"],note:"One-time password and duration."},
  {id:"sp2-023",domain:"banking",kind:"speech",input:"Փոխանցման գումարը 100000 AMD է։",mustInclude:["հարյուր հազար","դրամ"],note:"Large AMD transfer value."},
  {id:"sp2-024",domain:"banking",kind:"speech",input:"Օրական սահմանաչափը $10K է։",mustInclude:["տասը հազար դոլար"],note:"Compact banking USD limit."},
  {id:"sp2-025",domain:"banking",kind:"speech",input:"Ծառայության միջնորդավճարը 2% է։",mustInclude:["երկու","տոկոս"],note:"Banking fee percentage."},
];

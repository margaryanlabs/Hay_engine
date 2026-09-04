export type CallerConfirmation="yes"|"no"|"unknown";

const YES_PATTERNS=[
  /^(այո|հա|հաստատում եմ|ճիշտ է|ճիշտ ա|լավ է|լավ ա|համաձայն եմ|կարելի է|արեք|արա)([,.!։\s].*)?$/u,
  /^(yes|yeah|yep|correct|confirm|confirmed)([,.!\s].*)?$/i,
  /^(да|ага|верно|правильно|подтверждаю|согласен|согласна)([,.!\s].*)?$/iu,
];
const NO_PATTERNS=[
  /^(ոչ|չէ|չէ՛|սխալ է|սխալ ա|մի արեք|պետք չէ|չեմ հաստատում|չեղարկեք)([,.!։\s].*)?$/u,
  /^(no|nope|wrong|cancel|do not|don't)([,.!\s].*)?$/i,
  /^(нет|не надо|неверно|неправильно|отмена|отмените|не подтверждаю)([,.!\s].*)?$/iu,
];

export function parseCallerConfirmation(text:string):CallerConfirmation{
  const normalized=String(text||"").trim().replace(/\s+/g," ").slice(0,180);
  if(!normalized)return "unknown";
  if(YES_PATTERNS.some(pattern=>pattern.test(normalized)))return "yes";
  if(NO_PATTERNS.some(pattern=>pattern.test(normalized)))return "no";
  return "unknown";
}

export function confirmationPrompt(summaryHy:string){
  const summary=String(summaryHy||"").trim().replace(/\s+/g," ").slice(0,260);
  return summary?`${summary}։ Ճի՞շտ է, հաստատո՞ւմ եք։`:"Ճի՞շտ է, հաստատո՞ւմ եք։";
}

export function actionCapturedReply(type:string){
  switch(type){
    case "book_appointment":return "Հաստատեցի։ Գրանցման հարցումը փոխանցեցի։ Վերջնական ժամի հաստատումը կստանաք աշխատակցից։";
    case "create_callback":return "Հաստատեցի։ Հետզանգի հարցումը գրանցեցի, աշխատակիցը կկապվի ձեզ հետ։";
    case "create_lead":return "Հաստատեցի։ Ձեր տվյալները գրանցեցի, աշխատակիցը կկապվի ձեզ հետ։";
    case "take_order":return "Հաստատեցի։ Պատվերի հարցումը գրանցեցի։ Եթե պետք լինի վերջնական հաստատում կամ վճարում, աշխատակիցը կկապվի ձեզ հետ։";
    case "handoff_human":return "Հաստատեցի։ Փոխանցում եմ աշխատակցին։";
    default:return "Հաստատեցի։ Հարցումը գրանցեցի։";
  }
}

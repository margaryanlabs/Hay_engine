import type { EmployeeActionType } from "./types";

export type EmployeeCallOutcome=
  |"appointment_request"
  |"order_captured"
  |"callback_requested"
  |"lead_captured"
  |"human_handoff"
  |"resolved_without_action"
  |"voice_transport_failed";

export function classifyEmployeeCallOutcome(args:{
  actionTypes:EmployeeActionType[];
  failed?:boolean;
}) : EmployeeCallOutcome {
  if(args.failed)return "voice_transport_failed";
  const types=new Set(args.actionTypes);
  if(types.has("handoff_human"))return "human_handoff";
  if(types.has("book_appointment"))return "appointment_request";
  if(types.has("take_order"))return "order_captured";
  if(types.has("create_callback"))return "callback_requested";
  if(types.has("create_lead"))return "lead_captured";
  return "resolved_without_action";
}

export function employeeOutcomeSummaryHy(outcome:EmployeeCallOutcome){
  switch(outcome){
    case "appointment_request":return "Հաճախորդի գրանցման հարցումը ընդունվել է";
    case "order_captured":return "Պատվերի հարցումը ընդունվել է";
    case "callback_requested":return "Հետադարձ զանգի հարցումը ընդունվել է";
    case "lead_captured":return "Նոր հաճախորդի հարցումը գրանցվել է";
    case "human_handoff":return "Զանգը փոխանցվել է մարդ աշխատակցին";
    case "voice_transport_failed":return "Զանգը ավարտվել է տեխնիկական խնդրի պատճառով";
    default:return "Զանգը ավարտվել է առանց արտաքին գործողության";
  }
}

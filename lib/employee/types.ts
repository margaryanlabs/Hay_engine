export type EmployeeRole="receptionist"|"dispatcher"|"sales"|"orders";
export type EmployeeSpeechStyle="standard"|"natural"|"yerevan";
export type EmployeeChannel="web"|"phone"|"whatsapp"|"telegram";
export type EmployeeActionType="book_appointment"|"create_lead"|"create_callback"|"take_order"|"handoff_human";
export type EmployeeActionStatus="proposed"|"confirmed"|"executed"|"rejected"|"failed";

export type EmployeeCapabilities={
  appointments:boolean;
  leads:boolean;
  callbacks:boolean;
  orders:boolean;
  humanHandoff:boolean;
};

export type EmployeeActionPolicy={
  requireCallerConfirmation:boolean;
  autoExecute:EmployeeActionType[];
  neverExecute:EmployeeActionType[];
};

export type EmployeeProfile={
  id?:string;
  ownerId?:string;
  businessId?:string|null;
  displayName:string;
  role:EmployeeRole;
  locale:"hy-AM"|"en"|"ru";
  speechStyle:EmployeeSpeechStyle;
  greeting:string;
  voiceId?:string|null;
  status:"draft"|"active"|"paused";
  capabilities:EmployeeCapabilities;
  actionPolicy:EmployeeActionPolicy;
  businessRules:string[];
};

export type EmployeeBusinessContext={
  id?:string;
  name:string;
  category:string;
  description?:string;
  location?:string|null;
  offer?:string|null;
  audience?:string|null;
  tone?:string|null;
  workingHours?:string|null;
  services?:Array<{name:string;price?:string;durationMinutes?:number}>;
};

export type EmployeeConversationTurn={role:"caller"|"employee";text:string};

export type EmployeeActionDraft={
  type:EmployeeActionType;
  summaryHy:string;
  payload:Record<string,string|number|boolean|null>;
  requiresConfirmation:boolean;
};

export type EmployeeTurnResult={
  reply:string;
  intent:string;
  confidence:number;
  collected:Record<string,string>;
  missing:string[];
  action:EmployeeActionDraft|null;
  shouldHandoff:boolean;
  handoffReason:string|null;
  generatedBy:"openai"|"rules";
};

export const DEFAULT_EMPLOYEE_CAPABILITIES:EmployeeCapabilities={
  appointments:true,
  leads:true,
  callbacks:true,
  orders:false,
  humanHandoff:true,
};

export const DEFAULT_EMPLOYEE_ACTION_POLICY:EmployeeActionPolicy={
  requireCallerConfirmation:true,
  autoExecute:[],
  neverExecute:[],
};
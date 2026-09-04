import { SpeechEngine } from "@elevenlabs/elevenlabs-js";

const port=Number(process.env.PORT||3001);
const apiKey=String(process.env.ELEVENLABS_API_KEY||"");
const engineId=String(process.env.ELEVENLABS_SPEECH_ENGINE_ID||"");
const hayAppUrl=String(process.env.HAY_APP_URL||"").replace(/\/$/,"");
const workerSecret=String(process.env.HAY_VOICE_WORKER_SECRET||"");
const employeeId=String(process.env.HAY_DEFAULT_EMPLOYEE_ID||"");

for(const [name,value] of Object.entries({ELEVENLABS_API_KEY:apiKey,ELEVENLABS_SPEECH_ENGINE_ID:engineId,HAY_APP_URL:hayAppUrl,HAY_VOICE_WORKER_SECRET:workerSecret,HAY_DEFAULT_EMPLOYEE_ID:employeeId})){
  if(!value)throw new Error(`${name}_required`);
}

const callState=new Map();
const closeRequests=new Set();

function lastCallerMessage(transcript){
  for(let index=transcript.length-1;index>=0;index--){
    if(transcript[index]?.role==="user"&&String(transcript[index]?.content||"").trim())return String(transcript[index].content).trim();
  }
  return "";
}

async function hayPost(path,body,signal){
  const response=await fetch(`${hayAppUrl}${path}`,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${workerSecret}`},
    body:JSON.stringify(body),
    signal,
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`hay_${response.status}:${payload?.error||"invalid_response"}`);
  return payload;
}

async function admitCall(conversationId,session){
  const startedAt=Date.now();
  const payload=await hayPost("/api/employee/call/admit",{employeeId,externalSessionId:conversationId});
  const reservedSeconds=Math.max(30,Number(payload?.usage?.reservedSeconds||600));
  const timer=setTimeout(()=>{
    try{
      session?.sendResponse?.("Մեր այս զանգի ժամանակը ավարտվում է։ Եթե հարցը դեռ լուծված չէ, փոխանցեմ աշխատակցին։");
      session?.close?.();
    }catch(error){console.error(JSON.stringify({event:"employee_call_limit_close_failed",conversationId,employeeId,error:error instanceof Error?error.message:String(error)}));}
  },reservedSeconds*1000);
  timer.unref?.();
  const state={startedAt,reservedSeconds,timer,admission:payload};
  callState.set(conversationId,state);
  console.log(JSON.stringify({event:"employee_call_admitted",conversationId,employeeId,reservedSeconds,subscriptionEnforced:Boolean(payload?.usage?.enforced)}));
  return state;
}

async function ensureAdmission(session){
  const id=String(session?.conversationId||"");
  if(!id)throw new Error("conversation_id_missing");
  const current=callState.get(id);
  if(current?.admissionPromise)return current.admissionPromise;
  if(current?.admission)return current;
  const admissionPromise=admitCall(id,session).catch(error=>{
    callState.delete(id);
    throw error;
  });
  callState.set(id,{startedAt:Date.now(),admissionPromise});
  return admissionPromise;
}

async function askHay(transcript,externalSessionId,signal){
  const message=lastCallerMessage(transcript);
  if(!message)throw new Error("caller_message_missing");
  if(!externalSessionId)throw new Error("conversation_id_missing");
  const payload=await hayPost("/api/employee/realtime-turn",{employeeId,externalSessionId,message,history:transcript},signal);
  if(!payload?.turn?.reply)throw new Error("hay_employee_invalid_response");
  return payload.turn;
}

async function finishCall(session,failed=false){
  const conversationId=String(session?.conversationId||"");
  if(!conversationId||closeRequests.has(conversationId))return;
  closeRequests.add(conversationId);
  const state=callState.get(conversationId);
  if(state?.timer)clearTimeout(state.timer);
  try{
    const startedAt=Number(state?.startedAt||Date.now());
    const durationSeconds=Math.max(0,Math.floor((Date.now()-startedAt)/1000));
    await hayPost("/api/employee/session/close",{employeeId,externalSessionId:conversationId,state:failed?"failed":"completed",durationSeconds});
    console.log(JSON.stringify({event:"employee_call_finalized",conversationId,employeeId,durationSeconds,failed}));
  }catch(error){
    console.error(JSON.stringify({event:"employee_call_finalize_failed",conversationId,employeeId,error:error instanceof Error?error.message:String(error)}));
  }finally{
    callState.delete(conversationId);
  }
}

const server=new SpeechEngine.Server({
  port,
  apiKey,
  engineId,
  debug:process.env.HAY_VOICE_DEBUG==="true",
  onInit(conversationId,session){
    console.log(JSON.stringify({event:"employee_call_started",conversationId,employeeId}));
    const admissionPromise=admitCall(conversationId,session).catch(error=>{
      console.error(JSON.stringify({event:"employee_call_denied",conversationId,employeeId,error:error instanceof Error?error.message:String(error)}));
      try{session?.sendResponse?.("Ներողություն, այս պահին զանգը չենք կարող սպասարկել։ Խնդրում եմ փորձեք մի փոքր ուշ։");session?.close?.();}catch{}
      throw error;
    });
    callState.set(conversationId,{startedAt:Date.now(),admissionPromise});
  },
  async onTranscript(transcript,signal,session){
    try{
      await ensureAdmission(session);
      if(signal.aborted)return;
      const turn=await askHay(transcript,session.conversationId,signal);
      if(signal.aborted)return;
      session.sendResponse(turn.reply);
      console.log(JSON.stringify({event:"employee_turn",conversationId:session.conversationId,employeeId,intent:turn.intent,confidence:turn.confidence,action:turn.action?.type||null,handoff:turn.shouldHandoff}));
    }catch(error){
      if(signal.aborted)return;
      console.error(JSON.stringify({event:"employee_turn_failed",conversationId:session.conversationId,employeeId,error:error instanceof Error?error.message:String(error)}));
      try{session.sendResponse("Ներողություն, մի փոքր տեխնիկական խնդիր առաջացավ։ Մի պահ սպասեք, փոխանցեմ աշխատակցին։");}catch{}
    }
  },
  onClose(session){console.log(JSON.stringify({event:"employee_call_closed",conversationId:session.conversationId,employeeId}));void finishCall(session,false);},
  onDisconnect(session){console.warn(JSON.stringify({event:"employee_call_disconnected",conversationId:session.conversationId,employeeId}));void finishCall(session,true);},
  onError(error,session){console.error(JSON.stringify({event:"employee_voice_error",conversationId:session?.conversationId||null,employeeId,error:error?.message||String(error)}));},
});

server.start();
console.log(JSON.stringify({event:"hay_employee_voice_worker_ready",port,employeeId,engineId}));

async function shutdown(signal){
  console.log(JSON.stringify({event:"voice_worker_shutdown",signal}));
  await server.stop();
  process.exit(0);
}
process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=>void shutdown("SIGINT"));

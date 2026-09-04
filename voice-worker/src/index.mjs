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

function lastCallerMessage(transcript){
  for(let index=transcript.length-1;index>=0;index--){
    if(transcript[index]?.role==="user"&&String(transcript[index]?.content||"").trim())return String(transcript[index].content).trim();
  }
  return "";
}

async function askHay(transcript,externalSessionId,signal){
  const message=lastCallerMessage(transcript);
  if(!message)throw new Error("caller_message_missing");
  if(!externalSessionId)throw new Error("conversation_id_missing");
  const response=await fetch(`${hayAppUrl}/api/employee/realtime-turn`,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${workerSecret}`},
    body:JSON.stringify({employeeId,externalSessionId,message,history:transcript}),
    signal,
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.turn?.reply)throw new Error(`hay_employee_${response.status}:${payload?.error||"invalid_response"}`);
  return payload.turn;
}

const server=new SpeechEngine.Server({
  port,
  apiKey,
  engineId,
  debug:process.env.HAY_VOICE_DEBUG==="true",
  onInit(conversationId){console.log(JSON.stringify({event:"employee_call_started",conversationId,employeeId}));},
  async onTranscript(transcript,signal,session){
    try{
      const turn=await askHay(transcript,session.conversationId,signal);
      if(signal.aborted)return;
      session.sendResponse(turn.reply);
      console.log(JSON.stringify({event:"employee_turn",conversationId:session.conversationId,employeeId,intent:turn.intent,confidence:turn.confidence,action:turn.action?.type||null,handoff:turn.shouldHandoff}));
    }catch(error){
      if(signal.aborted)return;
      console.error(JSON.stringify({event:"employee_turn_failed",conversationId:session.conversationId,employeeId,error:error instanceof Error?error.message:String(error)}));
      session.sendResponse("Ներողություն, մի փոքր տեխնիկական խնդիր առաջացավ։ Մի պահ սպասեք, փոխանցեմ աշխատակցին։");
    }
  },
  onClose(session){console.log(JSON.stringify({event:"employee_call_closed",conversationId:session.conversationId,employeeId}));},
  onDisconnect(session){console.warn(JSON.stringify({event:"employee_call_disconnected",conversationId:session.conversationId,employeeId}));},
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

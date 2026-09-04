import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

function secretMatches(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const authorization=request.headers.get("authorization")||"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}

export async function POST(request:Request){
  if(!secretMatches(request))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||process.env.HAY_DEFAULT_EMPLOYEE_ID||"");
    const externalSessionId=String(body.externalSessionId||"").trim().slice(0,240);
    const requestedState=body.state==="failed"?"failed":"completed";
    if(!employeeId||!externalSessionId)return NextResponse.json({error:"employee_and_external_session_required"},{status:400});
    const admin=createAdminClient();
    const lookup=await admin.from("ai_employee_sessions").select("id,state").eq("employee_id",employeeId).eq("provider","elevenlabs-speech-engine").eq("external_session_id",externalSessionId).maybeSingle();
    if(lookup.error)return NextResponse.json({error:"employee_session_read_failed"},{status:500});
    if(!lookup.data)return NextResponse.json({closed:false,reason:"session_not_found"},{status:200});
    if(String(lookup.data.state)==="handoff")return NextResponse.json({closed:true,state:"handoff",preserved:true},{status:200});
    const outcome=requestedState==="failed"?"voice_transport_failed":"call_completed";
    const updated=await admin.from("ai_employee_sessions").update({state:requestedState,outcome,ended_at:new Date().toISOString()}).eq("id",lookup.data.id).eq("employee_id",employeeId).select("id,state,outcome,ended_at").single();
    if(updated.error)return NextResponse.json({error:"employee_session_close_failed"},{status:500});
    return NextResponse.json({closed:true,session:updated.data},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("HAY Employee session close failed",error);
    return NextResponse.json({error:"employee_session_close_failed"},{status:500});
  }
}

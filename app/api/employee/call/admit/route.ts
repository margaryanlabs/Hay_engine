import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { employeeProfileFromRow } from "@/lib/employee/store";
import { admitEmployeeCall } from "@/lib/employee/subscription";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";
const PROVIDER="elevenlabs-speech-engine";

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
    if(!employeeId||!externalSessionId)return NextResponse.json({error:"employee_and_external_session_required"},{status:400});
    const admin=createAdminClient();
    const employeeRead=await admin.from("ai_employees").select("*").eq("id",employeeId).maybeSingle();
    if(employeeRead.error)return NextResponse.json({error:"employee_read_failed"},{status:500});
    if(!employeeRead.data)return NextResponse.json({error:"employee_not_found"},{status:404});
    const employee=employeeProfileFromRow(employeeRead.data as Record<string,unknown>);
    if(employee.status!=="active"&&process.env.HAY_ALLOW_DRAFT_EMPLOYEE_REALTIME!=="true")return NextResponse.json({error:"employee_not_active"},{status:409});
    if(!employee.businessId||!employee.ownerId)return NextResponse.json({error:"employee_business_required"},{status:409});

    let sessionRead=await admin.from("ai_employee_sessions").select("id,state,metadata,started_at").eq("provider",PROVIDER).eq("external_session_id",externalSessionId).maybeSingle();
    if(sessionRead.error)return NextResponse.json({error:"employee_session_read_failed"},{status:500});
    if(!sessionRead.data){
      const inserted=await admin.from("ai_employee_sessions").insert({owner_id:employee.ownerId,business_id:employee.businessId,employee_id:employee.id,channel:"phone",provider:PROVIDER,external_session_id:externalSessionId,state:"active",consent_to_record:false,raw_transcript_retained:false,metadata:{transport:"speech-engine"}}).select("id,state,metadata,started_at").single();
      if(inserted.error){
        if(String(inserted.error.code)==="23505")sessionRead=await admin.from("ai_employee_sessions").select("id,state,metadata,started_at").eq("provider",PROVIDER).eq("external_session_id",externalSessionId).single();
        else return NextResponse.json({error:"employee_session_create_failed",detail:inserted.error.message},{status:500});
      }else sessionRead={...sessionRead,data:inserted.data,error:null};
    }
    const sessionId=String(sessionRead.data?.id||"");
    if(!sessionId)return NextResponse.json({error:"employee_session_required"},{status:500});
    const admission=await admitEmployeeCall({ownerId:employee.ownerId,employeeId:employee.id!,sessionId,provider:PROVIDER,externalSessionId});
    if(!admission.allowed){
      await admin.from("ai_employee_sessions").update({state:"failed",outcome:String(admission.reason),ended_at:new Date().toISOString(),metadata:{transport:"speech-engine",admissionDenied:true,reason:admission.reason}}).eq("id",sessionId).eq("owner_id",employee.ownerId);
      return NextResponse.json({error:admission.reason,admission},{status:admission.status});
    }
    const metadata={...(sessionRead.data?.metadata&&typeof sessionRead.data.metadata==="object"?sessionRead.data.metadata:{}),transport:"speech-engine",callUsageId:admission.usageId,reservedSeconds:admission.reservedSeconds,subscriptionEnforced:admission.enforced};
    await admin.from("ai_employee_sessions").update({metadata}).eq("id",sessionId).eq("owner_id",employee.ownerId);
    return NextResponse.json({allowed:true,employee:{id:employee.id,name:employee.displayName},session:{id:sessionId,externalSessionId},usage:{id:admission.usageId,reservedSeconds:admission.reservedSeconds,enforced:admission.enforced,duplicate:admission.duplicate||false}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("HAY Employee call admission failed",error);
    return NextResponse.json({error:"employee_call_admission_failed"},{status:500});
  }
}

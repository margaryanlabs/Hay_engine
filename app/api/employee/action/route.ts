import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { captureEmployeeAction,parseEmployeeActionType,sanitizeEmployeeActionPayload } from "@/lib/employee/action-service";
import { authenticatedEmployeeOwner,employeeProfileFromRow } from "@/lib/employee/store";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

function workerAuthorized(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const header=request.headers.get("authorization")||"";
  const supplied=header.startsWith("Bearer ")?header.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}

export async function POST(request:Request){
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  const trustedWorker=workerAuthorized(request);
  const owner=trustedWorker?null:await authenticatedEmployeeOwner();
  if(!trustedWorker&&!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||"");
    const type=parseEmployeeActionType(body.action?.type||body.type);
    const idempotencyKey=String(body.idempotencyKey||"").trim().slice(0,200);
    if(!employeeId)return NextResponse.json({error:"employee_id_required"},{status:400});
    if(!type)return NextResponse.json({error:"invalid_action_type"},{status:400});
    if(!idempotencyKey)return NextResponse.json({error:"idempotency_key_required"},{status:400});

    const admin=createAdminClient();
    const {data:employeeRow,error:employeeError}=await admin.from("ai_employees").select("*").eq("id",employeeId).maybeSingle();
    if(employeeError)return NextResponse.json({error:"employee_read_failed"},{status:500});
    if(!employeeRow)return NextResponse.json({error:"employee_not_found"},{status:404});
    const employee=employeeProfileFromRow(employeeRow as Record<string,unknown>);
    if(!trustedWorker&&employee.ownerId!==owner!.ownerId)return NextResponse.json({error:"forbidden"},{status:403});
    if(trustedWorker&&employee.status!=="active"&&process.env.HAY_ALLOW_DRAFT_EMPLOYEE_REALTIME!=="true")return NextResponse.json({error:"employee_not_active"},{status:409});

    const result=await captureEmployeeAction({
      employee,
      type,
      payload:sanitizeEmployeeActionPayload(body.action?.payload||body.payload),
      summary:String(body.action?.summaryHy||body.summary||type),
      idempotencyKey,
      callerConfirmed:body.callerConfirmed===true,
      sessionId:body.sessionId?String(body.sessionId):null,
    });
    return NextResponse.json(result.body,{status:result.status});
  }catch(error){
    console.error("HAY Employee action gate failed",error);
    return NextResponse.json({error:"employee_action_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}

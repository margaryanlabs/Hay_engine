import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { employeeProfileFromRow } from "@/lib/employee/store";
import { runEmployeeTurn } from "@/lib/employee/runtime";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { EmployeeConversationTurn } from "@/lib/employee/types";

export const runtime="nodejs";

function secretMatches(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const authorization=request.headers.get("authorization")||"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function parseHistory(value:unknown):EmployeeConversationTurn[]{
  if(!Array.isArray(value))return [];
  return value.slice(-16).flatMap(item=>{
    if(!item||typeof item!=="object")return [];
    const row=item as Record<string,unknown>;
    const role=row.role==="agent"||row.role==="employee"?"employee":row.role==="user"||row.role==="caller"?"caller":null;
    const text=String(row.content||row.text||"").trim().slice(0,2500);
    return role&&text?[{role,text}]:[];
  });
}

export async function POST(request:Request){
  if(!secretMatches(request))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||process.env.HAY_DEFAULT_EMPLOYEE_ID||"");
    const message=String(body.message||"").trim();
    if(!employeeId)return NextResponse.json({error:"employee_id_required"},{status:400});
    if(!message)return NextResponse.json({error:"message_required"},{status:400});
    const admin=createAdminClient();
    const {data:employeeRow,error:employeeError}=await admin.from("ai_employees").select("*").eq("id",employeeId).maybeSingle();
    if(employeeError)return NextResponse.json({error:"employee_read_failed"},{status:500});
    if(!employeeRow)return NextResponse.json({error:"employee_not_found"},{status:404});
    const employee=employeeProfileFromRow(employeeRow as Record<string,unknown>);
    if(employee.status!=="active"&&process.env.HAY_ALLOW_DRAFT_EMPLOYEE_REALTIME!=="true")return NextResponse.json({error:"employee_not_active"},{status:409});
    if(!employee.businessId)return NextResponse.json({error:"employee_business_required"},{status:409});
    const {data:business,error:businessError}=await admin.from("businesses").select("id,name,category,description,location,offer,audience,tone").eq("id",employee.businessId).eq("owner_id",employee.ownerId).maybeSingle();
    if(businessError)return NextResponse.json({error:"employee_business_read_failed"},{status:500});
    if(!business)return NextResponse.json({error:"employee_business_not_found"},{status:404});
    const turn=await runEmployeeTurn({profile:employee,business:{id:String(business.id),name:String(business.name),category:String(business.category),description:String(business.description||""),location:business.location?String(business.location):null,offer:business.offer?String(business.offer):null,audience:business.audience?String(business.audience):null,tone:business.tone?String(business.tone):null},message,history:parseHistory(body.history),signal:request.signal});
    return NextResponse.json({turn,employee:{id:employee.id,name:employee.displayName},business:{id:business.id,name:business.name}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(request.signal.aborted)return new Response(null,{status:499});
    console.error("HAY Employee realtime turn failed",error);
    return NextResponse.json({error:"employee_realtime_turn_failed"},{status:500});
  }
}
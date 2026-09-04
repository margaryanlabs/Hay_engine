import { NextResponse } from "next/server";
import { authenticatedEmployeeOwner,getEmployee,loadEmployeeBusiness } from "@/lib/employee/store";
import { runEmployeeTurn } from "@/lib/employee/runtime";
import type { EmployeeConversationTurn } from "@/lib/employee/types";

export const runtime="nodejs";

function history(value:unknown):EmployeeConversationTurn[]{
  if(!Array.isArray(value))return [];
  return value.slice(-16).flatMap(item=>{
    if(!item||typeof item!=="object")return [];
    const row=item as Record<string,unknown>;const role=row.role==="employee"?"employee":row.role==="caller"?"caller":null;
    const text=String(row.text||"").trim().slice(0,2500);
    return role&&text?[{role,text}]:[];
  });
}

export async function POST(request:Request){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||"");
    const message=String(body.message||"").trim();
    if(!employeeId)return NextResponse.json({error:"employee_id_required"},{status:400});
    if(!message)return NextResponse.json({error:"message_required"},{status:400});
    const employee=await getEmployee(owner.ownerId,employeeId);
    if(!employee)return NextResponse.json({error:"employee_not_found"},{status:404});
    if(employee.status==="paused")return NextResponse.json({error:"employee_paused"},{status:409});
    const business=await loadEmployeeBusiness(owner.ownerId,employee.businessId);
    if(!business)return NextResponse.json({error:"employee_business_required"},{status:409});
    const turn=await runEmployeeTurn({
      profile:employee,
      business:{id:String(business.id),name:String(business.name),category:String(business.category),description:String(business.description||""),location:business.location?String(business.location):null,offer:business.offer?String(business.offer):null,audience:business.audience?String(business.audience):null,tone:business.tone?String(business.tone):null},
      message,
      history:history(body.history),
      signal:request.signal,
    });
    return NextResponse.json({employee:{id:employee.id,name:employee.displayName,role:employee.role,locale:employee.locale,speechStyle:employee.speechStyle},business:{id:business.id,name:business.name},turn});
  }catch(error){
    if(request.signal.aborted)return new Response(null,{status:499});
    console.error("HAY Employee preview failed",error);
    return NextResponse.json({error:"employee_preview_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
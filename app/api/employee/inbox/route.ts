import { NextResponse } from "next/server";
import { authenticatedEmployeeOwner } from "@/lib/employee/store";

export const runtime="nodejs";

export async function GET(request:Request){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const businessId=new URL(request.url).searchParams.get("businessId");
  let query=owner.supabase.from("ai_employee_inbox").select("id,business_id,employee_id,kind,status,customer_name,phone,scheduled_for,title,payload,created_at,updated_at").eq("owner_id",owner.ownerId).order("created_at",{ascending:false}).limit(50);
  if(businessId)query=query.eq("business_id",businessId);
  const {data,error}=await query;
  if(error)return NextResponse.json({error:"employee_inbox_read_failed",detail:error.message},{status:500});
  return NextResponse.json({items:data||[]},{headers:{"Cache-Control":"no-store"}});
}
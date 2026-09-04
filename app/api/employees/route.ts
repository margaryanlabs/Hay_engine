import { NextResponse } from "next/server";
import { authenticatedEmployeeOwner,createEmployee,employeeMigrationReady,listEmployees } from "@/lib/employee/store";
import { checkEmployeeSeatAllowance } from "@/lib/employee/subscription";

export const runtime="nodejs";

export async function GET(){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await employeeMigrationReady()))return NextResponse.json({configured:false,error:"ai_employee_migration_014_required",employees:[]},{status:503});
  try{return NextResponse.json({configured:true,employees:await listEmployees(owner.ownerId)});}catch(error){return NextResponse.json({error:"employee_list_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}

export async function POST(request:Request){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await employeeMigrationReady()))return NextResponse.json({configured:false,error:"ai_employee_migration_014_required"},{status:503});
  try{
    const existing=await listEmployees(owner.ownerId);
    const seat=await checkEmployeeSeatAllowance(owner.ownerId,existing.length);
    if(!seat.allowed)return NextResponse.json({error:seat.reason,seat},{status:seat.status});
    const body=await request.json();
    const employee=await createEmployee(owner.ownerId,body&&typeof body==="object"?body:{});
    return NextResponse.json({configured:true,employee,seat},{status:201});
  }catch(error){return NextResponse.json({error:"employee_create_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}

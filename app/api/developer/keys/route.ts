import { NextResponse } from "next/server";
import { authenticatedOwner, createDeveloperKey, developerApiEnabled, developerApiHourlyLimit, developerApiMigrationReady, HAY_DEVELOPER_SCOPES, listDeveloperKeys, revokeDeveloperKey } from "@/lib/developer/api-keys";

export const runtime="nodejs";

export async function GET(){
  const owner=await authenticatedOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const migrationReady=await developerApiMigrationReady();
  const hourlyRequestLimit=developerApiHourlyLimit();
  if(!migrationReady)return NextResponse.json({configured:false,migrationReady:false,keys:[],scopes:HAY_DEVELOPER_SCOPES,developerApiEnabled:developerApiEnabled(),hourlyRequestLimit});
  const result=await listDeveloperKeys(owner.ownerId);
  return NextResponse.json({...result,migrationReady:true,scopes:HAY_DEVELOPER_SCOPES,developerApiEnabled:developerApiEnabled(),hourlyRequestLimit,developerApiReady:developerApiEnabled()&&hourlyRequestLimit>0});
}

export async function POST(request:Request){
  const owner=await authenticatedOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await developerApiMigrationReady()))return NextResponse.json({error:"developer_api_migration_required"},{status:503});
  const body=await request.json();
  const result=await createDeveloperKey({ownerId:owner.ownerId,name:String(body.name||""),scopes:body.scopes,expiresAt:body.expiresAt?String(body.expiresAt):null});
  if("error" in result&&result.error)return NextResponse.json(result,{status:result.error==="name_required"?400:result.error==="active_key_limit_reached"?409:500});
  return NextResponse.json({...result,message:"Copy this key now. HAY stores only its SHA-256 hash and cannot show the raw key again."},{status:201});
}

export async function DELETE(request:Request){
  const owner=await authenticatedOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json();
  const keyId=String(body.id||"");
  if(!keyId)return NextResponse.json({error:"key_id_required"},{status:400});
  const result=await revokeDeveloperKey(owner.ownerId,keyId);
  return NextResponse.json(result,{status:result.configured?200:503});
}

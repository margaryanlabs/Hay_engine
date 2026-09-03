import { NextResponse } from "next/server";
import { authenticatedOwner, developerApiMigrationReady, developerUsageSummary } from "@/lib/developer/api-keys";

export const runtime="nodejs";

export async function GET(){
  const owner=await authenticatedOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await developerApiMigrationReady()))return NextResponse.json({configured:false,migrationReady:false});
  return NextResponse.json(await developerUsageSummary(owner.ownerId));
}

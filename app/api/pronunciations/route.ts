import { NextResponse } from "next/server";
import { getPronunciationEntries, HAY_PRONUNCIATION_VERSION } from "@/lib/hay/pronunciation-registry";
import { archiveOwnerPronunciation, currentPronunciationOwner, listOwnerPronunciations, pronunciationRegistryReady, upsertOwnerPronunciation } from "@/lib/hay/pronunciation-store";

export const runtime="nodejs";

export async function GET(request:Request){
  const owner=await currentPronunciationOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const ready=await pronunciationRegistryReady();
  const core=getPronunciationEntries();
  if(!ready)return NextResponse.json({configured:false,migrationReady:false,coreVersion:HAY_PRONUNCIATION_VERSION,core,entries:[]});
  const businessId=new URL(request.url).searchParams.get("businessId");
  const result=await listOwnerPronunciations(owner.ownerId,businessId);
  return NextResponse.json({...result,migrationReady:true,coreVersion:HAY_PRONUNCIATION_VERSION,core});
}

export async function POST(request:Request){
  const owner=await currentPronunciationOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await pronunciationRegistryReady()))return NextResponse.json({error:"pronunciation_registry_migration_required"},{status:503});
  const body=await request.json();
  const scope=body.scope==="business"?"business":"account";
  const result=await upsertOwnerPronunciation({
    ownerId:owner.ownerId,
    scope,
    businessId:typeof body.businessId==="string"?body.businessId:null,
    written:body.written,
    spokenEastern:body.spokenEastern,
    spokenWestern:body.spokenWestern,
    category:body.category,
    notes:body.notes,
    sourceReference:body.sourceReference,
    consentReference:body.consentReference,
  });
  if("error" in result&&result.error){
    const status=result.error==="written_required"||result.error==="spoken_eastern_required"?400:result.error==="business_not_found"?404:500;
    return NextResponse.json(result,{status});
  }
  return NextResponse.json(result,{status:"updated" in result&&result.updated?200:201});
}

export async function DELETE(request:Request){
  const owner=await currentPronunciationOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json();
  const id=String(body.id||"").trim();
  if(!id)return NextResponse.json({error:"entry_id_required"},{status:400});
  const result=await archiveOwnerPronunciation(owner.ownerId,id);
  return NextResponse.json(result,{status:result.configured?200:503});
}

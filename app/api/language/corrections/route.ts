import { NextResponse } from "next/server";
import { correctionFlywheelReady, currentCorrectionActor, listOwnerCorrections, submitLanguageCorrection, withdrawLanguageCorrection } from "@/lib/hay/correction-store";

export const runtime="nodejs";

export async function GET(){
  const actor=await currentCorrectionActor();
  if(!actor)return NextResponse.json({error:"unauthorized"},{status:401});
  const migrationReady=await correctionFlywheelReady();
  if(!migrationReady)return NextResponse.json({configured:false,migrationReady:false,corrections:[],reviewer:actor.isReviewer});
  const result=await listOwnerCorrections(actor.ownerId);
  return NextResponse.json({...result,migrationReady:true,reviewer:actor.isReviewer});
}

export async function POST(request:Request){
  const actor=await currentCorrectionActor();
  if(!actor)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!(await correctionFlywheelReady()))return NextResponse.json({error:"language_correction_migration_required"},{status:503});
  const body=await request.json();
  const result=await submitLanguageCorrection({
    ownerId:actor.ownerId,
    businessId:typeof body.businessId==="string"?body.businessId:null,
    correctionType:body.correctionType,
    locale:body.locale,
    sourceText:body.sourceText,
    systemText:body.systemText,
    correctedText:body.correctedText,
    context:body.context,
    sourceEndpoint:body.sourceEndpoint,
    sourceRequestId:body.sourceRequestId,
    consentProductImprovement:body.consentProductImprovement,
    consentBenchmark:body.consentBenchmark,
    consentModelTraining:body.consentModelTraining,
  });
  if("error" in result&&result.error){
    const status=result.error==="source_text_required"||result.error==="corrected_text_required"?400:result.error==="business_not_found"?404:500;
    return NextResponse.json(result,{status});
  }
  return NextResponse.json(result,{status:201});
}

export async function DELETE(request:Request){
  const actor=await currentCorrectionActor();
  if(!actor)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json();
  const id=String(body.id||"").trim();
  if(!id)return NextResponse.json({error:"correction_id_required"},{status:400});
  const result=await withdrawLanguageCorrection(actor.ownerId,id);
  if("error" in result&&result.error){
    const status=result.error==="correction_not_found"?404:503;
    return NextResponse.json(result,{status});
  }
  return NextResponse.json(result);
}

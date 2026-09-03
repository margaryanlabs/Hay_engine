import { NextResponse } from "next/server";
import { correctionFlywheelReady, currentCorrectionActor, listReviewQueue, reviewLanguageCorrection } from "@/lib/hay/correction-store";

export const runtime="nodejs";

export async function GET(){
  const actor=await currentCorrectionActor();
  if(!actor)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!actor.isReviewer)return NextResponse.json({error:"forbidden"},{status:403});
  if(!(await correctionFlywheelReady()))return NextResponse.json({configured:false,migrationReady:false,corrections:[]});
  const result=await listReviewQueue(actor.ownerId);
  return NextResponse.json({...result,migrationReady:true});
}

export async function POST(request:Request){
  const actor=await currentCorrectionActor();
  if(!actor)return NextResponse.json({error:"unauthorized"},{status:401});
  if(!actor.isReviewer)return NextResponse.json({error:"forbidden"},{status:403});
  if(!(await correctionFlywheelReady()))return NextResponse.json({error:"language_correction_migration_required"},{status:503});
  const body=await request.json();
  const id=String(body.id||"").trim();
  const decision=body.decision==="reject"?"reject":body.decision==="accept"?"accept":null;
  if(!id)return NextResponse.json({error:"correction_id_required"},{status:400});
  if(!decision)return NextResponse.json({error:"review_decision_required"},{status:400});
  const result=await reviewLanguageCorrection({reviewerId:actor.ownerId,id,decision,notes:body.notes,promotePronunciation:body.promotePronunciation===true});
  if("error" in result&&result.error){
    const clientErrors=["correction_not_found","correction_withdrawn","product_improvement_consent_required"];
    return NextResponse.json(result,{status:clientErrors.includes(String(result.error))?409:503});
  }
  return NextResponse.json(result);
}

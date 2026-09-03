import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createCreatorProject } from "@/lib/creator/project";
import { buildAlignedCaptionCues } from "@/lib/creator/aligned-captions";
import { generateSceneImage } from "@/lib/providers/openai-image";
import { createArmenianSpeech } from "@/lib/providers/armenian-speech";
import { createArmenianSpeech as createElevenSpeech } from "@/lib/providers/elevenlabs";
import { resolveVoice } from "@/lib/providers/voice-catalog";
import { naturalizeArmenianText, type ArmenianSpeechStyle } from "@/lib/hay/conversational";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { dispatchRender } from "@/lib/render/client";
import type { Locale } from "@/lib/hay/types";

export const runtime = "nodejs";

function estimatedVoiceMinutes(text:string){
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.1,Math.round((words/135)*1000)/1000);
}

function allowanceStatus(reason:string|undefined){
  return reason==="unauthorized"?401:reason==="commercial_migration_required"?503:402;
}

async function uploadPrivateAsset(args: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; bytes: Uint8Array; contentType: string; extension: string }) {
  const objectPath = `${args.userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${args.extension}`;
  const { error } = await args.supabase.storage.from("hay-assets").upload(objectPath, args.bytes, { contentType: args.contentType, upsert: false, cacheControl: "3600" });
  if (error) throw error;
  const { data, error: signedError } = await args.supabase.storage.from("hay-assets").createSignedUrl(objectPath, 2 * 60 * 60);
  if (signedError || !data?.signedUrl) throw signedError || new Error("asset_signed_url_failed");
  return data.signedUrl;
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, message: "Dedicated HAY Supabase is required for the automated content factory." });
    const body = await request.json();
    const contentItemId = String(body.contentItemId || "");
    const force=body.force===true;
    if (!contentItemId) return NextResponse.json({ error: "content_item_id_required" }, { status: 400 });

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: content } = await supabase.from("content_items").select("id,business_id,platform,format,language,objective,hook,concept,caption,cta,hashtags,asset_brief,status,asset_url").eq("id", contentItemId).maybeSingle();
    if (!content) return NextResponse.json({ error: "content_not_found" }, { status: 404 });
    const { data: business } = await supabase.from("businesses").select("id,owner_id,name,category,description,location,offer,tone,primary_language").eq("id", content.business_id).eq("owner_id", userId).maybeSingle();
    if (!business) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const videoFormat = ["reel", "short", "video", "story"].includes(String(content.format));
    if (!videoFormat) return NextResponse.json({ configured: true, contentItemId, next: "static_asset_compositor", message: "This content format is static/carousel. Video factory is ready; static Armenian typography compositor is handled separately." }, { status: 202 });

    const {data:existingProject}=await supabase.from("creator_projects")
      .select("id,status,manifest,output_url,updated_at")
      .eq("owner_id",userId)
      .eq("content_item_id",content.id)
      .in("status",["planned","renderable","rendering","rendered"])
      .order("updated_at",{ascending:false})
      .limit(1)
      .maybeSingle();

    if(existingProject&&!force){
      const status=String(existingProject.status||"");
      const ready=status==="renderable"||status==="rendering"||status==="rendered";
      return NextResponse.json({
        configured:true,
        reused:true,
        contentItemId,
        project:existingProject.manifest,
        outputUrl:existingProject.output_url||content.asset_url||null,
        status,
        next:ready?status:"existing_generation_in_progress",
      },{status:ready?200:202});
    }

    if(force){
      const allowance=await checkUsageAllowance("content_assets",1);
      if(!allowance.allowed){
        return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status:allowanceStatus(allowance.reason)});
      }
    }

    const duration = content.format === "story" ? 10 : Number(body.duration) || 15;
    const language = (["hy", "en", "ru"].includes(String(content.language)) ? content.language : business.primary_language || "hy") as Locale;
    const prompt = [
      `Create a ${duration}-second ${content.platform} ${content.format} for ${business.name}, ${business.category}.`,
      `Objective: ${content.objective}. Hook: ${content.hook}. Concept: ${content.concept}.`,
      `Offer/context: ${business.offer || business.description}. Location: ${business.location || "Armenia"}.`,
      `Creative brief: ${content.asset_brief}.`,
      `Caption direction: ${content.caption}. CTA: ${content.cta}.`,
      language === "hy" ? "Use native, idiomatic contemporary Eastern Armenian. Keep visual generation free of baked-in Armenian text; HAY overlays exact typography separately." : "Keep visual generation text-free; HAY overlays typography separately.",
    ].join("\n");

    let project = await createCreatorProject({ prompt, language, dialect: "eastern", style: "advertising", duration });
    const { error: projectError } = await supabase.from("creator_projects").upsert({
      id: project.id,
      owner_id: userId,
      business_id: business.id,
      content_item_id: content.id,
      status: "planned",
      manifest: project,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (projectError) throw projectError;

    let audioSrc: string | undefined;
    let voiceUsage:{recorded:boolean;reason?:string;duplicate?:boolean}|null=null;
    if(language==="hy"){
      const voice=resolveVoice(body.voiceId?String(body.voiceId):undefined);
      if(voice){
        const preflightMinutes=estimatedVoiceMinutes(project.voice.text);
        const preflight=await checkUsageAllowance("voice_minutes",preflightMinutes);
        if(!preflight.allowed){
          await supabase.from("creator_projects").update({status:"planned",updated_at:new Date().toISOString()}).eq("id",project.id);
          return NextResponse.json({error:preflight.reason,meter:"voice_minutes",required:preflightMinutes,commercial:preflight.context,projectId:project.id},{status:allowanceStatus(preflight.reason)});
        }

        const style=(body.speechStyle==="standard"||body.speechStyle==="yerevan"?body.speechStyle:"natural") as ArmenianSpeechStyle;
        const naturalized=await naturalizeArmenianText(project.voice.text,style);
        const normalized=normalizeForSpeech(naturalized.text,"hy","eastern");
        const minutes=estimatedVoiceMinutes(normalized.spokenText);
        if(minutes>preflightMinutes){
          const allowance=await checkUsageAllowance("voice_minutes",minutes);
          if(!allowance.allowed){
            await supabase.from("creator_projects").update({status:"planned",updated_at:new Date().toISOString()}).eq("id",project.id);
            return NextResponse.json({error:allowance.reason,meter:"voice_minutes",required:minutes,commercial:allowance.context,projectId:project.id},{status:allowanceStatus(allowance.reason)});
          }
        }

        const speech=await createArmenianSpeech({text:normalized.spokenText,provider:voice.provider,providerVoiceId:voice.providerVoiceId});
        if(speech?.audioBase64){
          const aligned=buildAlignedCaptionCues(speech.alignment);
          if(aligned?.length) project={...project,captions:aligned,voice:{...project.voice,text:normalized.spokenText}};
          audioSrc=await uploadPrivateAsset({supabase,userId,bytes:Uint8Array.from(Buffer.from(speech.audioBase64,"base64")),contentType:speech.contentType,extension:"mp3"});
          voiceUsage=await recordUsage({
            meter:"voice_minutes",
            quantity:minutes,
            businessId:String(business.id),
            source:"content_factory_voice",
            idempotencyKey:`content-voice:${content.id}:${project.id}`,
            metadata:{contentItemId:content.id,projectId:project.id,language,provider:voice.provider,voiceId:voice.id,style,duration},
          });
        }
      }
    } else {
      const voiceId=String(body.providerVoiceId||process.env.ELEVENLABS_VOICE_ID||"")||undefined;
      if(voiceId){
        const minutes=estimatedVoiceMinutes(project.voice.text);
        const allowance=await checkUsageAllowance("voice_minutes",minutes);
        if(!allowance.allowed){
          await supabase.from("creator_projects").update({status:"planned",updated_at:new Date().toISOString()}).eq("id",project.id);
          return NextResponse.json({error:allowance.reason,meter:"voice_minutes",required:minutes,commercial:allowance.context,projectId:project.id},{status:allowanceStatus(allowance.reason)});
        }

        const speech=await createElevenSpeech(project.voice.text,voiceId);
        if(speech?.audioBase64){
          const aligned=buildAlignedCaptionCues(speech.alignment);
          if(aligned?.length) project={...project,captions:aligned};
          audioSrc=await uploadPrivateAsset({supabase,userId,bytes:Uint8Array.from(Buffer.from(speech.audioBase64,"base64")),contentType:speech.contentType,extension:"mp3"});
          voiceUsage=await recordUsage({
            meter:"voice_minutes",
            quantity:minutes,
            businessId:String(business.id),
            source:"content_factory_voice",
            idempotencyKey:`content-voice:${content.id}:${project.id}`,
            metadata:{contentItemId:content.id,projectId:project.id,language,provider:"elevenlabs",voiceId,duration},
          });
        }
      }
    }

    const sceneImages: Record<string, string> = {};
    const visualScenes = project.scenes.filter(scene => scene.asset.kind !== "motion" && scene.asset.kind !== "brand").slice(0, 3);
    await Promise.all(visualScenes.map(async scene => {
      const image = await generateSceneImage(scene.asset.prompt);
      if (!image?.b64) return;
      sceneImages[scene.id] = await uploadPrivateAsset({ supabase, userId, bytes: Uint8Array.from(Buffer.from(image.b64,"base64")), contentType: "image/png", extension: "png" });
    }));

    await supabase.from("creator_projects").update({ manifest: project, status: "renderable", updated_at: new Date().toISOString() }).eq("id", project.id);
    await supabase.from("content_items").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", content.id);

    const render = await dispatchRender({ project, sceneImages, audioSrc });
    const regenerationUsage=force?await recordUsage({
      meter:"content_assets",
      quantity:1,
      businessId:String(business.id),
      source:"video_regeneration",
      idempotencyKey:typeof body.requestId==="string"&&body.requestId?`video-regeneration:${body.requestId}`:undefined,
      metadata:{contentItemId:content.id,projectId:project.id,format:content.format},
    }):{recorded:false,reason:"included_in_plan"};

    return NextResponse.json({
      configured: true,
      reused:false,
      contentItemId,
      project,
      assets: { sceneImages: Object.keys(sceneImages).length, voice: Boolean(audioSrc) },
      render,
      commercialUsage:{regeneration:regenerationUsage,voice:voiceUsage},
      next: render.configured ? "render_worker" : "configure_render_worker",
    });
  } catch (error) {
    console.error("Marketing content factory failed", error);
    return NextResponse.json({ error: "marketing_content_factory_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

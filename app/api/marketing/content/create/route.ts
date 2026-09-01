import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createCreatorProject } from "@/lib/creator/project";
import { buildAlignedCaptionCues } from "@/lib/creator/aligned-captions";
import { generateSceneImage } from "@/lib/providers/openai-image";
import { createArmenianSpeech } from "@/lib/providers/elevenlabs";
import { dispatchRender } from "@/lib/render/client";
import type { Locale } from "@/lib/hay/types";

export const runtime = "nodejs";

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
    if (!contentItemId) return NextResponse.json({ error: "content_item_id_required" }, { status: 400 });

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: content } = await supabase.from("content_items").select("id,business_id,platform,format,language,objective,hook,concept,caption,cta,hashtags,asset_brief,status").eq("id", contentItemId).maybeSingle();
    if (!content) return NextResponse.json({ error: "content_not_found" }, { status: 404 });
    const { data: business } = await supabase.from("businesses").select("id,owner_id,name,category,description,location,offer,tone,primary_language").eq("id", content.business_id).eq("owner_id", userId).maybeSingle();
    if (!business) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const videoFormat = ["reel", "short", "video", "story"].includes(String(content.format));
    if (!videoFormat) return NextResponse.json({ configured: true, contentItemId, next: "static_asset_compositor", message: "This content format is static/carousel. Video factory is ready; static Armenian typography compositor is handled separately." }, { status: 202 });

    const duration = content.format === "story" ? 10 : Number(body.duration) || 15;
    const language = (["hy", "en", "ru"].includes(String(content.language)) ? content.language : business.primary_language || "hy") as Locale;
    const prompt = [
      `Create a ${duration}-second ${content.platform} ${content.format} for ${business.name}, ${business.category}.`,
      `Objective: ${content.objective}. Hook: ${content.hook}. Concept: ${content.concept}.`,
      `Offer/context: ${business.offer || business.description}. Location: ${business.location || "Armenia"}.`,
      `Creative brief: ${content.asset_brief}.`,
      `Caption direction: ${content.caption}. CTA: ${content.cta}.`,
      language === "hy" ? "Use native, idiomatic Armenian. Keep visual generation free of baked-in Armenian text; HAY overlays exact typography separately." : "Keep visual generation text-free; HAY overlays typography separately.",
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
    const voiceId = String(body.voiceId || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID || "") || undefined;
    if (voiceId) {
      const speech = await createArmenianSpeech(project.voice.text, voiceId);
      if (speech?.audioBase64) {
        const aligned = buildAlignedCaptionCues(speech.alignment);
        if (aligned?.length) project = { ...project, captions: aligned };
        audioSrc = await uploadPrivateAsset({ supabase, userId, bytes: Uint8Array.from(Buffer.from(speech.audioBase64, "base64")), contentType: speech.contentType, extension: "mp3" });
      }
    }

    const sceneImages: Record<string, string> = {};
    const visualScenes = project.scenes.filter(scene => scene.asset.kind !== "motion" && scene.asset.kind !== "brand").slice(0, 3);
    await Promise.all(visualScenes.map(async scene => {
      const image = await generateSceneImage(scene.asset.prompt);
      if (!image?.b64) return;
      sceneImages[scene.id] = await uploadPrivateAsset({ supabase, userId, bytes: Uint8Array.from(Buffer.from(image.b64, "base64")), contentType: "image/png", extension: "png" });
    }));

    await supabase.from("creator_projects").update({ manifest: project, status: "renderable", updated_at: new Date().toISOString() }).eq("id", project.id);
    await supabase.from("content_items").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", content.id);

    const render = await dispatchRender({ project, sceneImages, audioSrc });
    return NextResponse.json({
      configured: true,
      contentItemId,
      project,
      assets: { sceneImages: Object.keys(sceneImages).length, voice: Boolean(audioSrc) },
      render,
      next: render.configured ? "render_worker" : "configure_render_worker",
    });
  } catch (error) {
    console.error("Marketing content factory failed", error);
    return NextResponse.json({ error: "marketing_content_factory_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

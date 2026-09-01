import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "audio/mpeg", "audio/wav"]);
const maxBytes = 30 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, message: "Supabase is not configured." });
    const supabase = await createClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
    if (file.size > maxBytes) return NextResponse.json({ error: "file_too_large", maxBytes }, { status: 413 });

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("hay-assets").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    return NextResponse.json({ configured: true, bucket: "hay-assets", path, mimeType: file.type, size: file.size });
  } catch (error) {
    console.error("Asset upload failed", error);
    return NextResponse.json({ error: "asset_upload_failed" }, { status: 500 });
  }
}

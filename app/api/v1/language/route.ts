import { NextResponse } from "next/server";

export const runtime="nodejs";

export async function GET(request:Request){
  const origin=new URL(request.url).origin;
  return NextResponse.json({
    name:"HAY Armenian Language API",
    version:"v1",
    enabled:process.env.HAY_DEVELOPER_API_ENABLED==="true",
    authentication:{headers:["Authorization: Bearer hay_live_…","x-hay-api-key: hay_live_…"],note:"Raw keys are shown once at creation and stored only as SHA-256 hashes."},
    endpoints:{
      normalize:{method:"POST",url:`${origin}/api/v1/language/normalize`,scope:"language:normalize"},
      pronounce:{method:"POST",url:`${origin}/api/v1/language/pronounce`,scope:"language:pronounce"},
      captions:{method:"POST",url:`${origin}/api/v1/language/captions`,scope:"language:captions"},
      translate:{method:"POST",url:`${origin}/api/v1/language/translate`,scope:"language:translate"},
      transcribe:{method:"POST multipart/form-data",url:`${origin}/api/v1/language/transcribe`,scope:"language:transcribe"},
    },
  });
}

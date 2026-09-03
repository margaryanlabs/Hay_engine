import { NextResponse } from "next/server";
import { developerApiEnabled, developerApiHourlyLimit, developerApiMaxTextChars } from "@/lib/developer/api-keys";

export const runtime="nodejs";

export async function GET(request:Request){
  const origin=new URL(request.url).origin;
  const hourlyRequestLimit=developerApiHourlyLimit();
  const maxTextChars=developerApiMaxTextChars();
  const enabled=developerApiEnabled();
  return NextResponse.json({
    name:"HAY Armenian Language API",
    version:"v1",
    enabled,
    ready:enabled&&hourlyRequestLimit>0,
    authentication:{headers:["Authorization: Bearer hay_live_…","x-hay-api-key: hay_live_…"],note:"Raw keys are shown once at creation and stored only as SHA-256 hashes."},
    safety:{metered:true,perKeyHourlyRequestLimit:hourlyRequestLimit||null,maxTextChars,failClosedWithoutRateLimit:true},
    endpoints:{
      normalize:{method:"POST",url:`${origin}/api/v1/language/normalize`,scope:"language:normalize"},
      pronounce:{method:"POST",url:`${origin}/api/v1/language/pronounce`,scope:"language:pronounce"},
      captions:{method:"POST",url:`${origin}/api/v1/language/captions`,scope:"language:captions"},
      translate:{method:"POST",url:`${origin}/api/v1/language/translate`,scope:"language:translate"},
      transcribe:{method:"POST multipart/form-data",url:`${origin}/api/v1/language/transcribe`,scope:"language:transcribe"},
    },
  });
}

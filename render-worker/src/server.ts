import http from "node:http";
import path from "node:path";
import os from "node:os";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { RenderInput } from "./types";

const PORT = Number(process.env.PORT || 8080);
const WORKER_SECRET = process.env.RENDER_WORKER_SECRET || "";
const SUPABASE_URL = process.env.HAY_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RENDER_BUCKET = process.env.HAY_RENDER_BUCKET || "hay-renders";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });

function json(res:http.ServerResponse,status:number,body:unknown){const payload=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json","content-length":Buffer.byteLength(payload)});res.end(payload);}
async function body(req:http.IncomingMessage){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):{};}
function authorized(req:http.IncomingMessage){return Boolean(WORKER_SECRET)&&req.headers.authorization===`Bearer ${WORKER_SECRET}`;}

async function runRemotion(input:RenderInput,output:string,propsPath:string){
  await writeFile(propsPath,JSON.stringify(input));
  const binary=path.join(process.cwd(),"node_modules",".bin",process.platform==="win32"?"remotion.cmd":"remotion");
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(binary,["render","src/index.ts","HAY-Reel",output,`--props=${propsPath}`,"--overwrite","--codec=h264"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"],env:process.env});
    let stderr="";
    child.stdout.on("data",chunk=>process.stdout.write(chunk));
    child.stderr.on("data",chunk=>{stderr+=String(chunk);process.stderr.write(chunk);});
    child.on("error",reject);
    child.on("exit",code=>code===0?resolve():reject(new Error(`remotion_exit_${code}:${stderr.slice(-1200)}`)));
  });
}

async function renderJob(jobId:string,input:RenderInput){
  const projectId=input.project.id;
  const tmp=path.join(os.tmpdir(),`hay-render-${jobId}`);
  const output=path.join(tmp,"output.mp4");
  const props=path.join(tmp,"props.json");
  await mkdir(tmp,{recursive:true});
  try{
    await supabase.from("render_jobs").update({status:"rendering",error:null,updated_at:new Date().toISOString()}).eq("id",jobId);
    await supabase.from("creator_projects").update({status:"rendering",updated_at:new Date().toISOString()}).eq("id",projectId);
    await runRemotion(input,output,props);
    const file=await readFile(output);

    const {data:project,error:projectError}=await supabase.from("creator_projects").select("id,owner_id,business_id,content_item_id").eq("id",projectId).maybeSingle();
    if(projectError||!project)throw projectError||new Error("creator_project_missing");
    const objectPath=`${project.owner_id}/${new Date().toISOString().slice(0,10)}/${projectId}-${jobId}.mp4`;
    const {error:uploadError}=await supabase.storage.from(RENDER_BUCKET).upload(objectPath,file,{contentType:"video/mp4",upsert:false,cacheControl:"31536000"});
    if(uploadError)throw uploadError;
    const {data:publicData}=supabase.storage.from(RENDER_BUCKET).getPublicUrl(objectPath);
    const outputUrl=publicData.publicUrl;
    if(!outputUrl)throw new Error("render_public_url_missing");

    await Promise.all([
      supabase.from("render_jobs").update({status:"rendered",output_url:outputUrl,error:null,updated_at:new Date().toISOString()}).eq("id",jobId),
      supabase.from("creator_projects").update({status:"rendered",output_url:outputUrl,updated_at:new Date().toISOString()}).eq("id",projectId),
      project.content_item_id ? supabase.from("content_items").update({asset_url:outputUrl,status:"draft",updated_at:new Date().toISOString()}).eq("id",project.content_item_id) : Promise.resolve({}),
    ]);
    console.log("HAY render complete",{jobId,projectId,outputUrl});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error("HAY render failed",jobId,message);
    await Promise.all([
      supabase.from("render_jobs").update({status:"failed",error:message.slice(0,2000),updated_at:new Date().toISOString()}).eq("id",jobId),
      supabase.from("creator_projects").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",projectId),
    ]);
  }finally{await rm(tmp,{recursive:true,force:true}).catch(()=>undefined);}
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==="GET"&&req.url==="/health")return json(res,200,{ok:true,service:"HAY Render Worker",supabase:Boolean(SUPABASE_URL&&SUPABASE_SERVICE_ROLE_KEY),bucket:RENDER_BUCKET});
    if(!authorized(req))return json(res,401,{error:"unauthorized"});
    if(req.method==="POST"&&req.url==="/render"){
      if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return json(res,503,{error:"supabase_unconfigured"});
      const input=await body(req) as RenderInput;
      if(!input?.project?.id||input.project.format!=="9:16"||!Array.isArray(input.project.scenes))return json(res,400,{error:"invalid_render_input"});
      const {data:project}=await supabase.from("creator_projects").select("id").eq("id",input.project.id).maybeSingle();
      if(!project)return json(res,409,{error:"creator_project_must_be_persisted_first"});
      const {data:job,error}=await supabase.from("render_jobs").insert({project_id:input.project.id,status:"queued"}).select("id,status").single();
      if(error||!job)throw error||new Error("render_job_create_failed");
      void renderJob(job.id,input);
      return json(res,202,{jobId:job.id,status:"queued"});
    }
    const match=req.method==="GET"?req.url?.match(/^\/jobs\/([0-9a-f-]{36})$/i):null;
    if(match){
      const {data,error}=await supabase.from("render_jobs").select("id,project_id,status,output_url,error,created_at,updated_at").eq("id",match[1]).maybeSingle();
      if(error)throw error;
      return data?json(res,200,data):json(res,404,{error:"render_job_not_found"});
    }
    return json(res,404,{error:"not_found"});
  }catch(error){console.error("Render worker request failed",error);return json(res,500,{error:"render_worker_failed"});}
});

server.listen(PORT,"0.0.0.0",()=>console.log(`HAY render worker listening on :${PORT}`));

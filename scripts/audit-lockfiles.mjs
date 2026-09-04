import { readFileSync } from "node:fs";

const LOCKFILES=["package-lock.json","render-worker/package-lock.json","publish-worker/package-lock.json"];
const severityRank={info:0,low:1,moderate:2,high:3,critical:4};

function packageName(path){
  const marker="node_modules/";
  const index=path.lastIndexOf(marker);
  if(index<0)return null;
  return path.slice(index+marker.length)||null;
}

const versions=new Map();
for(const lockfile of LOCKFILES){
  const lock=JSON.parse(readFileSync(lockfile,"utf8"));
  for(const [path,entry] of Object.entries(lock.packages||{})){
    const name=packageName(path);
    const version=entry&&typeof entry==="object"?entry.version:null;
    if(!name||typeof version!=="string"||!version)continue;
    if(!versions.has(name))versions.set(name,new Set());
    versions.get(name).add(version);
  }
}
const requestBody=Object.fromEntries([...versions].sort(([a],[b])=>a.localeCompare(b)).map(([name,set])=>[name,[...set].sort()]));
if(!Object.keys(requestBody).length)throw new Error("No packages found in production lockfiles");

async function requestAudit(){
  const response=await fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","user-agent":"hay-engine-ci-lockfile-audit/1"},
    body:JSON.stringify(requestBody),
    signal:AbortSignal.timeout(120000),
  });
  if(!response.ok)throw new Error(`npm_bulk_audit_${response.status}:${(await response.text()).slice(0,300)}`);
  return response.json();
}

let response=null;
let lastError=null;
for(let attempt=1;attempt<=4;attempt++){
  try{response=await requestAudit();break;}catch(error){lastError=error;if(attempt<4)await new Promise(resolve=>setTimeout(resolve,attempt*5000));}
}
if(!response)throw lastError||new Error("npm_bulk_audit_unavailable");

const advisories=[];
for(const [name,items] of Object.entries(response)){
  if(!Array.isArray(items))continue;
  for(const advisory of items){
    const severity=String(advisory?.severity||"info").toLowerCase();
    advisories.push({package:name,id:advisory?.id??null,title:String(advisory?.title||""),severity,url:String(advisory?.url||"")});
  }
}
const blocking=advisories.filter(item=>(severityRank[item.severity]??0)>=severityRank.high);
console.log(JSON.stringify({dependencyAudit:"npm-bulk-advisory",lockfiles:LOCKFILES,packages:Object.keys(requestBody).length,advisories:advisories.length,blocking},null,2));
if(blocking.length){
  console.error(`High/critical production dependency advisories detected: ${blocking.map(item=>`${item.package}:${item.severity}:${item.id}`).join(", ")}`);
  process.exit(1);
}

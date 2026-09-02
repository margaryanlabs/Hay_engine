export function selectedBusinessId(){
  if(typeof window==="undefined")return "";
  return new URLSearchParams(window.location.search).get("businessId")||"";
}

export function businessScopedPath(path:string,businessId?:string|null){
  if(!businessId)return path;
  const [base,query=""]=path.split("?");
  const params=new URLSearchParams(query);
  params.set("businessId",businessId);
  return `${base}?${params.toString()}`;
}

export async function selectBusinessWorkspace(businessId:string, navigate=true){
  const response=await fetch("/api/studio/workspace",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({businessId}),
  });
  const data=await response.json();
  if(response.status===401){window.location.href="/login";return {selected:false,changed:false};}
  if(!response.ok)throw new Error(data.detail||data.error||"workspace_selection_failed");
  if(data.configured===false)return {selected:false,changed:false};
  if(navigate){
    const url=new URL(window.location.href);
    if(businessId)url.searchParams.set("businessId",businessId);else url.searchParams.delete("businessId");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }
  return {selected:true,changed:Boolean(data.changed)};
}

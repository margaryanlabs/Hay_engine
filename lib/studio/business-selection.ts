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

export function selectBusinessInUrl(businessId:string){
  const url=new URL(window.location.href);
  if(businessId)url.searchParams.set("businessId",businessId);else url.searchParams.delete("businessId");
  window.location.assign(`${url.pathname}${url.search}${url.hash}`);
}

export class HttpError extends Error { constructor(public status:number, public url:string, message:string){ super(message) } }
export async function getJson<T>(url:string, label:string):Promise<T>{
  const response = await fetch(url, { method:"GET", headers:{ Accept:"application/json, text/plain, */*" }, timeout:20, debugLabel:label })
  if (!response.ok) throw new HttpError(response.status, url, `${label}: HTTP ${response.status}`)
  return await response.json() as T
}
export function url(base:string, path:string, query:Record<string,string|number|boolean|undefined|null>={}):string{
  const u=new URL(path,base)
  for(const [k,v] of Object.entries(query)) if(v!==undefined && v!==null && v!=="") u.searchParams.set(k,String(v))
  return u.toString()
}

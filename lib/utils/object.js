export function classNames(...xs){return xs.filter(Boolean).join(" ");}
export function get(obj, path, def=undefined){
  if(!obj||!path) return def;
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let cur = obj;
  for(const p of parts){
    if(cur && typeof cur === "object" && p in cur){ cur = cur[p]; } else { return def; }
  }
  return cur;
}
export function pick(data, keys, def=undefined){
  for(const k of keys){
    const v = get(data, k);
    if(v !== undefined && v !== null && v !== "") return v;
  }
  return def;
}

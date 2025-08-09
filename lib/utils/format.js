export function formatIso(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    return d.toLocaleString();
  }catch{ return String(iso); }
}

import { LS_KEY_ORDERS, LS_KEY_FLAGS } from "../constants";
export function cacheOrdersToLocalStorage(orders, queryUrl){
  try{
    localStorage.setItem(LS_KEY_ORDERS, JSON.stringify({orders, cachedAt: new Date().toISOString(), queryUrl}));
  }catch{}
}
export function loadOrdersFromLocalStorage(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY_ORDERS) || "null");
  }catch{return null;}
}
export function saveFlags(flags){
  try{ localStorage.setItem(LS_KEY_FLAGS, JSON.stringify(flags||{})); }catch{}
}
export function loadFlags(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY_FLAGS) || "{}"); }catch{return {};}
}

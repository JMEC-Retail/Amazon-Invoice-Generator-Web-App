import { ORDERS_API_BASE } from "../constants";
import { pick } from "../utils/object";

export function buildOrdersQuery({ allPages=false, maxPerPage=10, lastUpdatedAfter }={}){
  const u = new URL(`${ORDERS_API_BASE}/orders`);
  u.searchParams.set("all_pages", String(!!allPages));
  u.searchParams.set("max_per_page", String(maxPerPage || 10));
  if(lastUpdatedAfter) u.searchParams.set("last_updated_after", lastUpdatedAfter);
  return u.toString();
}

export async function fetchOrders({ allPages=false, maxPerPage=10, lastUpdatedAfter }={}){
  const url = buildOrdersQuery({ allPages, maxPerPage, lastUpdatedAfter });
  const res = await fetch(url);
  if(!res.ok) throw new Error(`GET /orders failed: ${res.status}`);
  const json = await res.json();
  return normalizeOrders(json);
}

export function normalizeOrders(json){
  const arr = pick(json, ["Orders","orders","data.orders"], []) || [];
  return Array.isArray(arr) ? arr : [];
}

export function getOrderId(o){
  return pick(o, ["AmazonOrderId","amazonOrderId","amazon_order_id","OrderId","orderId","order_id","id"], "");
}
export function getPurchaseDate(o){
  return pick(o, ["PurchaseDate","purchaseDate","purchase_date","LastUpdateDate","lastUpdateDate","last_update_date","CreatedAt","created_at"], "");
}
export function getOrderStatus(o){
  return pick(o, ["OrderStatus","orderStatus","order_status","Status","status"], "");
}
export function getBuyerName(o){
  return pick(o, ["BuyerInfo.BuyerName","buyerInfo.buyerName","BuyerName","buyerName","buyer_info.buyer_name","Buyer.Name","buyer.name"], "");
}

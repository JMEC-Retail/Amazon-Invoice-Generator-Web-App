import { ORDERS_API_BASE, INVOICES_API_BASE } from "../constants";
import { pick } from "../utils/object";

export async function buildInvoicePayload(orderId){
  const r = await fetch(`${ORDERS_API_BASE}/orders/${orderId}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  if(!r.ok) throw new Error(`POST /orders/${orderId}/invoice failed: ${r.status}`);
  return await r.json();
}

export async function createInvoice(payload){
  const r = await fetch(`${INVOICES_API_BASE}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if(!r.ok) throw new Error(`POST /invoices failed: ${r.status}`);
  return await r.json();
}

export function extractDownloadUrl(data){
  const candidates = [
    "download_link","download_url","download_uri","pdf_url","file_url","invoice_url","url",
    "data.download_link","data.download_url","data.download_uri",
    "result.download_link","result.download_url","result.download_uri",
    "payload.download_link","payload.download_url","payload.download_uri",
    "invoice.download_link","invoice.download_url","invoice.download_uri",
    "links.download","links.self",
  ];
  return pick(data, candidates, undefined);
}

export function resolveUrl(u, base=INVOICES_API_BASE){
  if(!u) return undefined;
  try{ return new URL(u, base).toString(); }catch{ return u; }
}

export function deriveUrlFromId(data, base=INVOICES_API_BASE){
  const id = pick(data, ["invoice_id","invoiceId","id","data.invoice_id","payload.invoice_id"]);
  if(!id) return undefined;
  return `${base}/invoices/${id}/download`;
}

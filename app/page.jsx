"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function pick(obj, keys, fallback = undefined) {
  for (const k of keys) {
    const parts = k.split(".");
    let v = obj;
    for (const p of parts) {
      if (v && typeof v === "object" && p in v) v = v[p];
      else {
        v = undefined;
        break;
      }
    }
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
}

function normalizeOrders(raw) {
  const arr =
    pick(raw, ["payload.Orders", "payload.orders", "Orders", "orders"], []) || [];
  return Array.isArray(arr) ? arr : [];
}

function getOrderId(o) {
  return (
    o?.AmazonOrderId || o?.amazonOrderId || o?.orderId || o?.order_id || o?.id || ""
  );
}

function getPurchaseDate(o) {
  return (
    o?.PurchaseDate || o?.purchaseDate || o?.purchase_date || o?.CreatedAt || ""
  );
}

function getOrderStatus(o) {
  return (
    o?.OrderStatus || o?.orderStatus || o?.order_status || o?.Status || o?.status || ""
  );
}

function getBuyerName(o) {
  return (
    pick(o, [
      "BuyerInfo.BuyerName",
      "buyerInfo.buyerName",
      "BuyerName",
      "buyerName",
    ]) || ""
  );
}

function prettyDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function AmazonOrdersApp() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [allPages, setAllPages] = useState(false);
  const [maxPerPage, setMaxPerPage] = useState(10);
  const [lastUpdatedAfter, setLastUpdatedAfter] = useState(
    "2025-08-07T00:00:00Z"
  );

  const [invoiceMap, setInvoiceMap] = useState({});

  const queryUrl = useMemo(() => {
    const u = new URL(`${API_BASE}/orders`);
    u.searchParams.set("all_pages", String(allPages));
    u.searchParams.set("max_per_page", String(maxPerPage || 10));
    if (lastUpdatedAfter) u.searchParams.set("last_updated_after", lastUpdatedAfter);
    return u.toString();
  }, [allPages, maxPerPage, lastUpdatedAfter]);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(`GET /orders failed: ${res.status}`);
      const json = await res.json();
      const list = normalizeOrders(json);
      setOrders(list);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  function saveOrdersToFile() {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([JSON.stringify(orders, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `amazon-orders-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to save file: " + (e.message || e));
    }
  }

  function updateInvoiceState(orderId, patch) {
    setInvoiceMap((prev) => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), ...patch } }));
  }

  function extractDownloadUrl(data) {
    const candidates = [
      "download_url",
      "pdf_url",
      "url",
      "downloadUrl",
      "pdfUrl",
      "data.download_url",
      "data.pdf_url",
      "result.download_url",
      "payload.download_url",
    ];
    return pick(data, candidates, undefined);
  }

  async function generateInvoice(order) {
    const orderId = getOrderId(order);
    if (!orderId) return;
    updateInvoiceState(orderId, { status: "generating", url: undefined, errMsg: undefined });

    try {
      const step1 = await fetch(`${API_BASE}/orders/${orderId}/invoice`);
      if (!step1.ok) throw new Error(`GET /orders/${orderId}/invoice failed: ${step1.status}`);
      const invoicePayload = await step1.json();

      const step2 = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoicePayload),
      });
      if (!step2.ok) throw new Error(`POST /invoices failed: ${step2.status}`);
      const result = await step2.json();

      const url = extractDownloadUrl(result);
      updateInvoiceState(orderId, { status: "ready", url, data: result });
    } catch (e) {
      console.error(e);
      updateInvoiceState(orderId, { status: "error", errMsg: e.message || String(e) });
      alert(`Invoice failed for ${orderId}: ${e.message || e}`);
    }
  }

  function OrdersTable() {
    if (!orders?.length && !loading) {
      return (
        <div className="text-sm text-gray-600">No orders yet. Try adjusting filters and click <b>Fetch Orders</b>.</div>
      );
    }

    return (
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Amazon Order ID</th>
              <th className="px-4 py-2 text-left font-semibold">Purchase Date</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Buyer</th>
              <th className="px-4 py-2 text-left font-semibold">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => {
              const orderId = getOrderId(o);
              const inv = invoiceMap[orderId];
              return (
                <tr key={orderId || idx} className={classNames(idx % 2 ? "bg-white" : "bg-gray-50")}>
                  <td className="px-4 py-2 font-mono">{orderId || "—"}</td>
                  <td className="px-4 py-2">{prettyDate(getPurchaseDate(o))}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {getOrderStatus(o) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{getBuyerName(o) || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {inv?.status === "ready" && inv?.url ? (
                        <a
                          href={inv.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg border px-3 py-1 text-xs hover:bg-gray-100"
                        >
                          Download Invoice
                        </a>
                      ) : (
                        <button
                          onClick={() => generateInvoice(o)}
                          disabled={inv?.status === "generating"}
                          className={classNames(
                            "inline-flex items-center rounded-lg bg-black text-white px-3 py-1 text-xs",
                            inv?.status === "generating" && "opacity-60 cursor-wait"
                          )}
                        >
                          {inv?.status === "generating" ? "Generating…" : "Generate Invoice"}
                        </button>
                      )}
                      {inv?.status === "error" && (
                        <span className="text-xs text-red-600">Failed</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Amazon Orders & Invoices</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              className={classNames(
                "rounded-lg bg-black text-white px-4 py-2",
                loading && "opacity-60 cursor-wait"
              )}
              disabled={loading}
            >
              {loading ? "Fetching…" : "Fetch Orders"}
            </button>
            <button
              onClick={saveOrdersToFile}
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
              disabled={!orders?.length}
              title={!orders?.length ? "No orders to save yet" : ""}
            >
              Save Orders JSON
            </button>
          </div>
        </header>

        <section className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-600 mb-1">Last Updated After (ISO)</span>
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="YYYY-MM-DDTHH:mm:ssZ"
                value={lastUpdatedAfter}
                onChange={(e) => setLastUpdatedAfter(e.target.value)}
              />
            </label>

            <label className="flex flex-col text-sm">
              <span className="text-gray-600 mb-1">Max Per Page</span>
              <input
                type="number"
                min={1}
                className="border rounded-lg px-3 py-2"
                value={maxPerPage}
                onChange={(e) => setMaxPerPage(parseInt(e.target.value || "10", 10))}
              />
            </label>

            <label className="flex items-center gap-2 text-sm mt-6 md:mt-0">
              <input
                type="checkbox"
                checked={allPages}
                onChange={(e) => setAllPages(e.target.checked)}
              />
              <span>Fetch all pages</span>
            </label>

            <div className="flex items-end">
              <button
                onClick={fetchOrders}
                className={classNames(
                  "w-full md:w-auto rounded-lg bg-black text-white px-4 py-2",
                  loading && "opacity-60 cursor-wait"
                )}
                disabled={loading}
              >
                {loading ? "Fetching…" : "Apply & Fetch"}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Target URL: <span className="font-mono">{queryUrl}</span>
          </p>
        </section>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <section>
          <OrdersTable />
        </section>
      </div>
    </div>
  );
}

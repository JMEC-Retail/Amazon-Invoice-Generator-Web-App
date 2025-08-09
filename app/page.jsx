'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";

// Single-file React app for Next.js page (app/page.jsx or pages/index.js)
// Requires your Orders API on http://localhost:5000 and your Invoices API on http://localhost:8000 with CORS for http://localhost:3000.
// Tailwind used for quick styling.

const ORDERS_API_BASE = "http://localhost:5000";
const INVOICES_API_BASE = "http://localhost:8000";

// LocalStorage keys
const LS_KEY = "amazon-orders-cache-v1"; // stores {orders, cachedAt, queryUrl}
const LS_KEY_FLAGS = "amazon-orders-flags-v1"; // stores preferences (e.g., autoSaveJson)

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
  // Accepts multiple shapes: {payload: {Orders: [...]}} or {Orders:[...]} or {orders:[...]} or just [...]
  if (Array.isArray(raw)) return raw;
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

// ---- Persistence helpers ----
function cacheOrdersToLocalStorage(orders, queryUrl) {
  try {
    const payload = { orders, cachedAt: new Date().toISOString(), queryUrl };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch { }
}

function loadOrdersFromLocalStorage() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return null;
    const obj = JSON.parse(s);
    const list = normalizeOrders(obj?.orders ?? obj);
    return { orders: list, cachedAt: obj?.cachedAt, queryUrl: obj?.queryUrl };
  } catch {
    return null;
  }
}

function loadFlags() {
  try {
    const s = localStorage.getItem(LS_KEY_FLAGS);
    if (!s) return {};
    return JSON.parse(s) || {};
  } catch {
    return {};
  }
}

function saveFlags(flags) {
  try {
    localStorage.setItem(LS_KEY_FLAGS, JSON.stringify(flags || {}));
  } catch { }
}

// Trigger a JSON file download (used after a successful fetch, if enabled)
function downloadOrdersJson(orders) {
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

  // 'usingCache' = we are showing data from localStorage or manual file import
  const [usingCache, setUsingCache] = useState(false);
  const [cacheMeta, setCacheMeta] = useState(null); // {cachedAt, queryUrl, source: 'localStorage'|'file'}

  // Preferences
  const [autoSaveJson, setAutoSaveJson] = useState(true);

  // orderId -> { status: 'idle'|'generating'|'ready'|'error', url?: string, data?: any, errMsg?: string }
  const [invoiceMap, setInvoiceMap] = useState({});

  const fileInputRef = useRef(null);

  useEffect(() => {
    const f = loadFlags();
    if (typeof f.autoSaveJson === "boolean") setAutoSaveJson(f.autoSaveJson);
  }, []);

  useEffect(() => {
    saveFlags({ autoSaveJson });
  }, [autoSaveJson]);

  const queryUrl = useMemo(() => {
    const u = new URL(`${ORDERS_API_BASE}/orders`);
    u.searchParams.set("all_pages", String(allPages));
    u.searchParams.set("max_per_page", String(maxPerPage || 10));
    if (lastUpdatedAfter) u.searchParams.set("last_updated_after", lastUpdatedAfter);
    return u.toString();
  }, [allPages, maxPerPage, lastUpdatedAfter]);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    setUsingCache(false);
    setCacheMeta(null);
    try {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(`GET /orders failed: ${res.status}`);
      const json = await res.json();
      const list = normalizeOrders(json);
      setOrders(list);

      // Persist to localStorage for offline fallback
      cacheOrdersToLocalStorage(list, queryUrl);

      // Also download a JSON snapshot if enabled
      if (autoSaveJson) {
        downloadOrdersJson(list);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));

      // Fallback to cached localStorage copy if available
      const cached = loadOrdersFromLocalStorage();
      if (cached?.orders?.length) {
        setOrders(cached.orders);
        setUsingCache(true);
        setCacheMeta({ cachedAt: cached.cachedAt, queryUrl: cached.queryUrl, source: "localStorage" });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function manualSaveNow() {
    try {
      downloadOrdersJson(orders);
    } catch (e) {
      alert("Failed to save file: " + (e.message || e));
    }
  }

  function updateInvoiceState(orderId, patch) {
    setInvoiceMap((prev) => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), ...patch } }));
  }

  function extractDownloadUrl(data) {
    const candidates = [
      // your API:
      "download_link",

      // common alternates:
      "download_url", "download_uri", "pdf_url", "file_url", "invoice_url", "url",

      // nested variants:
      "data.download_link",
      "data.download_url", "data.download_uri",
      "result.download_link",
      "result.download_url", "result.download_uri",
      "payload.download_link",
      "payload.download_url", "payload.download_uri",
      "invoice.download_link", "invoice.download_url", "invoice.download_uri",
      "links.download", "links.self",
    ];
    return pick(data, candidates, undefined);
  }

  function resolveUrl(u) {
    if (!u) return undefined;
    try {
      // supports relative paths like "/download/ea59e4...bca57"
      return new URL(u, INVOICES_API_BASE).toString();
    } catch {
      return u;
    }
  }


  function resolveUrl(u) {
    if (!u) return undefined;
    try { return new URL(u, INVOICES_API_BASE).toString(); } catch { return u; }
  }

  // If API returns an id but not a URL, construct a reasonable default.
  function deriveUrlFromId(data) {
    const id = pick(data, ["invoice_id", "invoiceId", "id", "data.invoice_id", "payload.invoice_id"]);
    if (!id) return undefined;
    // Try your service’s canonical path here if different:
    const candidates = [
      `${INVOICES_API_BASE}/invoices/${id}/download`,
      `${INVOICES_API_BASE}/invoices/${id}.pdf`,
      `${INVOICES_API_BASE}/invoices/${id}?download=1`,
      `${INVOICES_API_BASE}/invoices/${id}`,
    ];
    return candidates[0];
  }


  function resolveUrl(u) {
    if (!u) return undefined;
    try {
      // supports relative paths like "/invoices/123.pdf"
      return new URL(u, INVOICES_API_BASE).toString();
    } catch {
      return u; // if it's already absolute but URL() fails for some reason
    }
  }

  async function generateInvoice(order) {
    const orderId = getOrderId(order);
    if (!orderId) return;
    updateInvoiceState(orderId, { status: "generating", url: undefined, errMsg: undefined });

    try {
      // 1) Build invoice payload for this order (POST instead of GET)
      const step1 = await fetch(`${ORDERS_API_BASE}/orders/${orderId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If your API doesn't need any fields, you can send {} or omit body entirely.
        body: JSON.stringify({ order_id: orderId })
      });
      if (!step1.ok) throw new Error(`POST /orders/${orderId}/invoice failed: ${step1.status}`);
      const invoicePayload = await step1.json();

      // 2) POST to /invoices to actually generate & store it
      const step2 = await fetch(`${INVOICES_API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoicePayload),
      });
      if (!step2.ok) throw new Error(`POST /invoices failed: ${step2.status}`);
      const result = await step2.json();

      const urlRaw =
        extractDownloadUrl(result) ??
        extractDownloadUrl(invoicePayload); // fallback if builder step returned it

      const url = resolveUrl(urlRaw);
      updateInvoiceState(orderId, { status: "ready", url, data: result });

    } catch (e) {
      console.error(e);
      updateInvoiceState(orderId, { status: "error", errMsg: e.message || String(e) });
      alert(`Invoice failed for ${orderId}: ${e.message || e}`);
    }
  }

  // Manual load from localStorage
  function loadCached() {
    const cached = loadOrdersFromLocalStorage();
    if (cached?.orders?.length) {
      setOrders(cached.orders);
      setUsingCache(true);
      setCacheMeta({ cachedAt: cached.cachedAt, queryUrl: cached.queryUrl, source: "localStorage" });
      setError("");
    } else {
      alert("No cached orders found in this browser.");
    }
  }

  // Manual load from a user-selected JSON file
  function onChooseFile() {
    fileInputRef.current?.click();
  }
  function onFilePicked(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const list = normalizeOrders(obj);
        if (!Array.isArray(list)) throw new Error("Invalid orders format in file.");
        setOrders(list);
        setUsingCache(true);
        setCacheMeta({ cachedAt: new Date().toISOString(), queryUrl: "(from file)", source: "file" });
        setError("");

        // Also store into localStorage for future offline use
        cacheOrdersToLocalStorage(list, "(from file)");
      } catch (err) {
        alert("Failed to read JSON: " + (err.message || err));
      }
    };
    reader.readAsText(f);
    // Reset the input so same file can be selected again later
    e.target.value = "";
  }

  function OrdersTable() {
    if (!orders?.length && !loading) {
      return (
        <div className="text-sm text-gray-600">No orders yet. Try adjusting filters and click <b>Fetch Orders</b>, or <button onClick={loadCached} className="underline">load cached</button>.</div>
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
                          Download invoice
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
              onClick={manualSaveNow}
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
              disabled={!orders?.length}
              title={!orders?.length ? "No orders to save yet" : ""}
            >
              Save Orders JSON
            </button>
            <button
              onClick={loadCached}
              className="rounded-lg border px-4 py-2"
              title="Load cached orders from this browser"
            >
              Load Cached
            </button>
            <button
              onClick={onChooseFile}
              className="rounded-lg border px-4 py-2"
              title="Load from a saved JSON file"
            >
              Load From File…
            </button>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              ref={fileInputRef}
              onChange={onFilePicked}
            />
          </div>
        </header>

        <section className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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

            <label className="flex items-center gap-2 text-sm mt-6 md:mt-0">
              <input
                type="checkbox"
                checked={autoSaveJson}
                onChange={(e) => setAutoSaveJson(e.target.checked)}
              />
              <span>Auto‑save JSON on fetch</span>
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

        {(usingCache || error) && (
          <div className="border border-yellow-200 bg-yellow-50 text-yellow-800 px-4 py-3 rounded-xl">
            {usingCache ? (
              <div>
                <strong>Offline cache in use.</strong>{" "}
                <span className="text-xs">
                  {cacheMeta?.source === "file"
                    ? "Loaded from a local JSON file."
                    : "Loaded from browser storage."}{" "}
                  {cacheMeta?.cachedAt && <> Cached at {prettyDate(cacheMeta.cachedAt)}.</>}{" "}
                  {cacheMeta?.queryUrl && <> Source: <span className="font-mono">{cacheMeta.queryUrl}</span></>}
                </span>
              </div>
            ) : (
              <div>
                <strong>Fetch error:</strong> {error}
              </div>
            )}
          </div>
        )}

        <section>
          <OrdersTable />
        </section>
      </div>
    </div>
  );
}

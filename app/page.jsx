'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import FetchControls from "../components/controls/FetchControls";
import ImportExportControls from "../components/controls/ImportExportControls";
import OrdersTable from "../components/OrdersTable";
import { classNames } from "../lib/utils/object";
import { cacheOrdersToLocalStorage, loadOrdersFromLocalStorage, loadFlags, saveFlags } from "../lib/storage/ordersCache";
import { buildOrdersQuery, fetchOrders as apiFetchOrders, normalizeOrders, getOrderId } from "../lib/api/orders";
import { buildInvoicePayload, createInvoice, extractDownloadUrl, resolveUrl, deriveUrlFromId } from "../lib/api/invoices";

export default function Page(){
  // Data
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Query params
  const [allPages, setAllPages] = useState(false);
  const [maxPerPage, setMaxPerPage] = useState(10);
  const [lastUpdatedAfter, setLastUpdatedAfter] = useState("2025-08-07T00:00:00Z");

  // Cache state
  const [usingCache, setUsingCache] = useState(false);
  const [cacheMeta, setCacheMeta] = useState(null);

  // Preferences
  const [autoSaveJson, setAutoSaveJson] = useState(false);

  // Invoice per-row state
  const [invoiceMap, setInvoiceMap] = useState({}); // { [orderId]: { status: 'idle'|'generating'|'ready'|'error', url?, errMsg? } }
  function orderKey(id){ return String(id || ""); }
  function updateInvoiceState(id, patch){ setInvoiceMap((m) => ({ ...m, [orderKey(id)]: { ...(m[orderKey(id)] || {}), ...patch } })); }

  const fileInputRef = useRef(null);

  // Load preferences
  useEffect(() => { const f = loadFlags(); if(typeof f.autoSaveJson === "boolean") setAutoSaveJson(f.autoSaveJson); }, []);
  useEffect(() => { saveFlags({ autoSaveJson }); }, [autoSaveJson]);

  const queryUrl = useMemo(() => buildOrdersQuery({ allPages, maxPerPage, lastUpdatedAfter }), [allPages, maxPerPage, lastUpdatedAfter]);

  async function doFetchOrders(){
    setLoading(true); setError(""); setUsingCache(false); setCacheMeta(null);
    try{
      const list = await apiFetchOrders({ allPages, maxPerPage, lastUpdatedAfter });
      setOrders(list);
      cacheOrdersToLocalStorage(list, queryUrl);
      if(autoSaveJson) triggerJsonDownload(list);
    }catch(e){
      console.error(e);
      setError(e.message || String(e));
    }finally{
      setLoading(false);
    }
  }

  useEffect(() => { doFetchOrders(); /* initial load */ }, []);

  useEffect(() => {
    try{
      const cache = JSON.parse(localStorage.getItem("amazon-orders-cache-v1") || "null");
      if(cache?.orders?.length){ setCacheMeta({ cachedAt: cache.cachedAt, queryUrl: cache.queryUrl, source: "localStorage" }); }
    }catch{}
  }, [orders]);

  function triggerJsonDownload(list){
    try{
      const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `amazon-orders-${new Date().toISOString().replaceAll(":","-")}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch{}
  }

  async function generateInvoice(order){
    const id = orderKey(getOrderId(order)); if(!id) return;
    updateInvoiceState(id, { status: "generating", url: undefined, errMsg: undefined });
    try{
      const payload = await buildInvoicePayload(id);
      const result = await createInvoice(payload);
      const urlRaw = extractDownloadUrl(result) ?? extractDownloadUrl(payload) ?? deriveUrlFromId(result) ?? deriveUrlFromId(payload);
      const url = resolveUrl(urlRaw);
      if(!url) throw new Error("No download link found in API response");
      updateInvoiceState(id, { status: "ready", url });
    }catch(e){
      console.error(e);
      updateInvoiceState(id, { status: "error", errMsg: e.message || String(e) });
      alert(`Invoice failed for ${id}: ${e.message || e}`);
    }
  }

  function openInvoice(id){ /* placeholder for analytics if needed */ }

  function onImportFile(e){
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const json = JSON.parse(reader.result);
        const list = normalizeOrders(json);
        setOrders(list); setUsingCache(true); setCacheMeta({ cachedAt: new Date().toISOString(), queryUrl: "(file)", source: "file" });
        // persist as cache too
        cacheOrdersToLocalStorage(list, "(from file)");
      }catch(err){
        alert("Failed to read JSON: " + (err.message || err));
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  function manualSaveNow(){ if(!orders?.length) return; triggerJsonDownload(orders); }
  function loadCached(){ const cached = loadOrdersFromLocalStorage(); if(cached?.orders?.length){ setOrders(cached.orders); setUsingCache(true); setCacheMeta({ cachedAt: cached.cachedAt, queryUrl: cached.queryUrl, source: "localStorage" }); } }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Amazon Orders</h1>
          <p className="text-gray-600 text-sm">Simple UI for viewing orders and generating invoices</p>
        </div>
        {cacheMeta && (
          <div className="text-xs text-gray-500">
            Showing {usingCache ? "cached" : "live"} data; cached at {cacheMeta.cachedAt}.<br/>
            Source: {cacheMeta.source} ({cacheMeta.queryUrl})
          </div>
        )}
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <FetchControls
            loading={loading}
            fetchOrders={doFetchOrders}
            allPages={allPages} setAllPages={setAllPages}
            maxPerPage={maxPerPage} setMaxPerPage={setMaxPerPage}
            lastUpdatedAfter={lastUpdatedAfter} setLastUpdatedAfter={setLastUpdatedAfter}
          />
          <div className="flex-1" />
          <ImportExportControls
            orders={orders}
            autoSaveJson={autoSaveJson}
            setAutoSaveJson={setAutoSaveJson}
            onImport={onImportFile}
            onSaveNow={manualSaveNow}
            fileInputRef={fileInputRef}
          />
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Fetch error:</strong> {error}
          </div>
        )}
      </section>

      <section>
        <OrdersTable
          orders={orders}
          invoiceMap={invoiceMap}
          onGenerate={generateInvoice}
          onOpen={openInvoice}
          onLoadCached={loadCached}
          loading={loading}
        />
      </section>
    </div>
  );
}

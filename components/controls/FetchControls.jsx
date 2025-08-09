'use client';
import React from "react";
import { classNames } from "../../lib/utils/object";

function isoToLocalValue(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`; // expected by <input type="datetime-local">
  }catch{
    return "";
  }
}

export default function FetchControls({ loading, fetchOrders, allPages, setAllPages, maxPerPage, setMaxPerPage, lastUpdatedAfter, setLastUpdatedAfter }){
  const localVal = isoToLocalValue(lastUpdatedAfter);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <button
        onClick={fetchOrders}
        className={classNames("rounded-lg bg-black text-white px-4 py-2", loading && "opacity-60 cursor-wait")}
        disabled={loading}
      >
        {loading ? "Fetching…" : "Fetch Orders"}
      </button>

      <label className="flex flex-col text-sm">
        <span className="text-gray-600 mb-1">Last Updated After</span>
        <input
          type="datetime-local"
          className="border rounded-lg px-3 py-2"
          value={localVal}
          onChange={(e) => {
            const v = e.target.value;
            if(!v){ setLastUpdatedAfter(""); return; }
            try{
              // Convert the local datetime-local value to ISO (UTC Z)
              const iso = new Date(v).toISOString();
              setLastUpdatedAfter(iso);
            }catch{
              setLastUpdatedAfter("");
            }
          }}
        />
      </label>

      <label className="flex flex-col text-sm">
        <span className="text-gray-600 mb-1">Max Per Page</span>
        <input
          type="number"
          min={1}
          className="border rounded-lg px-3 py-2"
          value={maxPerPage}
          onChange={(e) => setMaxPerPage(Number(e.target.value || 10))}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
        <span>All Pages</span>
      </label>
    </div>
  );
}

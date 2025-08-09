'use client';
import React from "react";
import { classNames } from "../../lib/utils/object";

export default function ImportExportControls({ orders, autoSaveJson, setAutoSaveJson, onImport, onSaveNow, fileInputRef }){
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoSaveJson}
          onChange={(e) => setAutoSaveJson(e.target.checked)}
        />
        <span>Auto-save Orders JSON</span>
      </label>

      <button
        onClick={onSaveNow}
        className="rounded-lg border px-4 py-2 disabled:opacity-50"
        disabled={!orders?.length}
        title={!orders?.length ? "No orders to save yet" : ""}
      >
        Save Orders JSON
      </button>

      <input type="file" ref={fileInputRef} accept="application/json" onChange={onImport} className="hidden" />
      <button
        onClick={() => fileInputRef?.current?.click()}
        className="rounded-lg border px-4 py-2"
      >
        Import JSON
      </button>
    </div>
  );
}

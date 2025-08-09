'use client';
import React from "react";
import { formatIso } from "../lib/utils/format";
import { classNames } from "../lib/utils/object";
import { getOrderId, getPurchaseDate, getOrderStatus, getBuyerName } from "../lib/api/orders";

export default function OrdersTable({ orders, invoiceMap, onGenerate, onOpen, onLoadCached, loading }){
  if(!orders?.length && !loading){
    return (
      <div className="text-sm text-gray-600">
        No orders yet. Try fetching, or{" "}
        <button onClick={onLoadCached} className="underline">load cached</button>.
      </div>
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
        <tbody className="divide-y">
          {orders.map((o, idx) => {
            const id = getOrderId(o);
            const key = String(id || idx);
            const cell = invoiceMap[key] || { status: "idle" };
            const disabled = cell.status === "generating";
            return (
              <tr key={key} className="odd:bg-white even:bg-gray-50">
                <td className="px-4 py-2 font-mono">{id}</td>
                <td className="px-4 py-2">{formatIso(getPurchaseDate(o))}</td>
                <td className="px-4 py-2">{getOrderStatus(o)}</td>
                <td className="px-4 py-2">{getBuyerName(o)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {cell.status === "ready" && cell.url ? (
                      <a
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1"
                        href={cell.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => onOpen?.(id)}
                      >
                        Download Invoice
                      </a>
                    ) : (
                      <button
                        className={classNames("rounded-lg bg-blue-600 text-white px-3 py-1", disabled && "opacity-60 cursor-wait")}
                        disabled={disabled}
                        onClick={() => onGenerate(o)}
                        title={cell.errMsg || ""}
                      >
                        {cell.status === "generating" ? "Generating…" : "Generate Invoice"}
                      </button>
                    )}
                    {cell.errMsg ? <span className="text-red-600 text-xs">{cell.errMsg}</span> : null}
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

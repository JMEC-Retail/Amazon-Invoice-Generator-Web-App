# Amazon Orders UI — Modularized

This is a modular refactor of your Next.js app so it’s easier to maintain and extend.

## What changed
- Split the **monolithic** `app/page.jsx` into **reusable components**, **API helpers**, **storage** and **utility** modules.
- Added environment-based config: set `NEXT_PUBLIC_ORDERS_API_BASE` and `NEXT_PUBLIC_INVOICES_API_BASE` (with sensible localhost defaults).
- Fixed/centralized invoice download link resolution. If your API returns any of `download_link`, `download_url`, etc., or just an `invoice_id`, the UI now builds a proper download URL and swaps the button to **Download Invoice** reliably.

## Project structure
```
app/
  globals.css
  layout.js
  page.jsx                # Thin container that wires everything together
components/
  OrdersTable.jsx
  controls/
    FetchControls.jsx
    ImportExportControls.jsx
lib/
  constants.js            # API bases + LS keys (uses NEXT_PUBLIC_* env vars)
  api/
    orders.js             # GET /orders helpers + field selectors
    invoices.js           # Build payload + create invoice + link resolvers
  storage/
    ordersCache.js        # localStorage helpers
  utils/
    object.js             # classNames, get, pick
    format.js             # formatIso
public/
  robots.txt
```

## Env vars
Create a `.env.local` (Next.js) with:
```
NEXT_PUBLIC_ORDERS_API_BASE=http://localhost:5000
NEXT_PUBLIC_INVOICES_API_BASE=http://localhost:8000
```

## Scripts
```
npm install
npm run dev   # http://localhost:3000
```

## Notes
- The **Generate → Download** state is tracked per order in `invoiceMap` so it won’t flicker back after success.
- If you change your invoice service’s download route, update `deriveUrlFromId()` in `lib/api/invoices.js`.

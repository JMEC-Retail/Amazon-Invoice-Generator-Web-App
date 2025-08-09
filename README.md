# Amazon Orders UI (Next.js + Tailwind, JS)

## Quick start
```bash
cd amazon-orders-ui
pnpm install   # or npm install / yarn
pnpm dev       # http://localhost:3000
```

Make sure your FastAPI server runs at `http://localhost:5000` with CORS allowing `http://localhost:3000`.

### FastAPI CORS example
```py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

You can change the API by editing the `API_BASE` constant inside `app/page.jsx`.

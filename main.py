"""
main.py — FastAPI application entry point

Registers all routers and configures CORS for the React frontend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import upload, chat, crm

app = FastAPI(
    title       = "SME Knowledge Retrieval Agent",
    description = "Multi-format RAG system for SME operations — Team TheAlchemists",
    version     = "1.0.0",
)

# ── CORS — allow React frontend to talk to this backend ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(crm.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "SME RAG API is running."}
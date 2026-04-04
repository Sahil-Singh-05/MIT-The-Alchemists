"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import auth, chat, crm, upload

app = FastAPI(
    title="SME Knowledge Retrieval Agent",
    description="Multi-format RAG system for SME operations - Team TheAlchemists",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(crm.router)
app.include_router(upload.router)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "SME RAG API is running."}

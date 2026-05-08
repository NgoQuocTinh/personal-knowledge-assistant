import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from config.setting import get_settings

from src.api.notes import router as notes_router
from src.api.graph import router as graph_router
from src.api.ai import router as ai_router

# Initialize Settings
settings = get_settings()

# Initialize FastAPI application
app = FastAPI(
    title=f"{settings.app.name} API",
    version=settings.app.version,
    description="Knowledge Base & RAG Backend API"
)

# Add routes for managing Notes, Graph, and AI
app.include_router(notes_router)
app.include_router(graph_router)
app.include_router(ai_router)

# Configure CORS so Frontend (Next.js) can call API
origins = [
    "http://localhost:3000",   # Default Next.js
    "http://localhost:5173",   # Default Vite/SvelteKit
    "*",                       # Allow all origins for Production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", tags=["System"])
def health_check():
    """Check system status"""
    return {
        "status": "healthy",
        "app_name": settings.app.name,
        "version": settings.app.version,
        "environment": settings.app.environment
    }

# --- DISABLED PRELOAD FOR RENDER DEPLOYMENT ---
# @app.on_event("startup")
# async def startup_event():
#     """Preload AI models into RAM/VRAM (Warm-up) to reduce latency on first request."""
#     ...

import os
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port 
    )

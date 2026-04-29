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
]

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

@app.on_event("startup")
async def startup_event():
    """Preload AI models into RAM/VRAM (Warm-up) to reduce latency on first request."""
    print("Preloading AI models into RAM/VRAM (Warm-up)... Please wait.")

    def preload_models():
        try:
            # 1. Tải Embedding Model
            from src.ingestion.embeddings import embedding_manager
            embed_model = embedding_manager.get_embeddings()
            embed_model.embed_query("Xin chào") 
            print("Successfully loaded Embedding Model!")

            # 2. Tải LLM Model (Gửi 1 request ẩn)
            from src.llm.llm_factory import get_llm
            llm = get_llm()
            llm.invoke("Hi")
            print("Successfully loaded LLM Model (Ollama/ChatModel)!")

        except Exception as e:
            print(f"Error occurred while preloading models: {e}")

    # Chạy Background task để không block quá trình khởi động API
    asyncio.create_task(asyncio.to_thread(preload_models))

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True # Auto restart on code change (for dev environment)
    )

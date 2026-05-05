import shutil
import json
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config.setting import get_settings
from src.utils.logger import setup_logger
from src.ingestion.markdown_processor import MarkdownProcessor
from src.ingestion.embeddings import embedding_manager
from src.retrieval.retriever import AdvancedRetriever
from src.chat.prompts import get_rag_prompt, get_conversation_prompt, get_standalone_question_prompt
from src.llm.llm_factory import get_llm
from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser

from src.api.graph import generate_and_cache_graph

logger = setup_logger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI"])
settings = get_settings()

class SyncResponse(BaseModel):
    status: str
    message: str
    documents_processed: int
    chunks_created: int

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    selected_files: Optional[List[str]] = None
    messages: Optional[List[Message]] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

@router.post("/sync", response_model=SyncResponse)
def sync_markdown_to_vector_db():
    """
    Scan the entire data directory, process Markdown, and load into ChromaDB.
    Replace old data with new data.
    """
    logger.info("Starting Markdown VectorDB sync...")
    
    try:
        db_path = Path(settings.paths.db_dir)
        # Ensure the DB directory exists
        db_path.mkdir(parents=True, exist_ok=True)
        embeddings = embedding_manager.get_embeddings()
        
        # Clear old DB collection if it exists to avoid stale data (ChromaDB will create a new one if it doesn't exist)
        if db_path.exists() and db_path.is_dir():
            try:
                old_db = Chroma(
                    persist_directory=str(db_path),
                    embedding_function=embeddings,
                    collection_name=settings.vectordb.collection_name
                )
                old_db.delete_collection()
                logger.info("Cleared old ChromaDB collection.")
            except Exception as e:
                logger.warning(f"Could not clear old collection (may not exist): {e}")
    
        # Scan and process markdown files
        processor = MarkdownProcessor()
        chunks = processor.process_directory()
        
        if not chunks:
            return SyncResponse(
                status="success",
                message="No markdown files found to process.",
                documents_processed=0,
                chunks_created=0
            )
            
        # Load into ChromaDB
        vectordb = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=str(db_path),
            collection_name=settings.vectordb.collection_name,
            collection_metadata={
                "hnsw:space": settings.vectordb.hnsw.space,
                "hnsw:construction_ef": settings.vectordb.hnsw.construction_ef,
                "hnsw:M": settings.vectordb.hnsw.M
            }
        )
        
        count = vectordb._collection.count()
        logger.info(f"Sync complete. Vectors created: {count}")
        
        # Extract the actual number of original files processed
        unique_files = set()
        for c in chunks:
            filename = c.metadata.get('filename')
            if filename:
                unique_files.add(filename)
                
        # Generate & Cache Semantic Graph data after ChromaDB is ready
        logger.info("Executing async graph caching task...")
        # Since it's in sync logic, we can run it synchronously before return
        generate_and_cache_graph()
                
        return SyncResponse(
            status="success",
            message="Successfully synced markdown files to VectorDB.",
            documents_processed=len(unique_files),
            chunks_created=count
        )
        
    except Exception as e:
        logger.error(f"Error during sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@router.post("/chat")
def chat_with_ai(request: ChatRequest):
    """
    RAG Chat endpoint with Server-Sent Events (SSE) Streaming.
    Can filter static context by `selected_files` list.
    """
    logger.info(f"Received chat query. Grounding files: {request.selected_files}")
    
    try:
        # Initialize VectorDB and Retriever
        db_path = settings.paths.db_dir
        if not Path(db_path).exists():
            raise HTTPException(status_code=400, detail="VectorDB not found. Please sync first.")
            
        embeddings = embedding_manager.get_embeddings()
        vectordb = Chroma(
            persist_directory=str(db_path),
            embedding_function=embeddings,
            collection_name=settings.vectordb.collection_name
        )
        
        retriever = AdvancedRetriever(vectordb)
        
        # Create metadata filter if user specifies selected_files
        search_filter = None
        if request.selected_files:
            if len(request.selected_files) == 1:
                search_filter = {"filename": request.selected_files[0]}
            else:
                search_filter = {"filename": {"$in": request.selected_files}}
                
        # Build string history
        history_text = ""
        if request.messages:
            for msg in request.messages[-5:]: # Get last 5 msgs
                role = "User" if msg.role == "user" else "AI"
                history_text += f"{role}: {msg.content}\n"
                
        # Initialize LLM
        llm = get_llm()

        # ADVANCED RAG: LLM Query Reformulation (Standalone Question)
        search_query = request.query
        if history_text.strip():
            logger.info("Reformulating query based on history...")
            reformulate_prompt = get_standalone_question_prompt()
            reformulate_chain = reformulate_prompt | llm | StrOutputParser()
            search_query = reformulate_chain.invoke({
                "history": history_text,
                "question": request.query
            }).strip()
            logger.info(f"Re-formulated Query: {search_query}")
            
        # Retrieve docs using MMR and filter with the reformulated query
        docs = retriever.retrieve(
            query=search_query,
            search_type='mmr',
            k=settings.retrieval.k,
            filter=search_filter
        )
        
        # Create Context format
        context_text = "\n\n".join([f"[Document: {d.metadata.get('filename')}]\n{d.page_content}" for d in docs])
        unique_sources = retriever.get_unique_sources(docs)
        
        if history_text.strip():
            prompt = get_conversation_prompt()
            inputs = {
                "context": context_text,
                "history": history_text,
                "question": request.query
            }
        else:
            prompt = get_rag_prompt()
            inputs = {
                "context": context_text,
                "question": request.query
            }
        
        # Langchain chain execution
        chain = prompt | llm | StrOutputParser()
        
        def response_generator():
            # First, send the list of sources
            yield f"data: {json.dumps({'sources': unique_sources})}\n\n"
            
            # Then, stream the LLM response chunk by chunk
            for chunk in chain.stream(inputs):
                # Send each piece of text inside a JSON event
                yield f"data: {json.dumps({'answer_chunk': chunk})}\n\n"
                
            # Finally, send a concluding message
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(response_generator(), media_type="text/event-stream")
        
    except HTTPException:
        # Re-raise known exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")

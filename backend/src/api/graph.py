import json
from fastapi import APIRouter, HTTPException
from pathlib import Path

from config.setting import get_settings
from src.ingestion.markdown_processor import MarkdownProcessor
from src.utils.logger import setup_logger
from src.ingestion.embeddings import embedding_manager
from langchain_chroma import Chroma

logger = setup_logger(__name__)

# Create Router for Graph API
router = APIRouter(prefix="/api/graph", tags=["Graph"])
settings = get_settings()

DATA_DIR = Path(settings.paths.data_dir).resolve()
GRAPH_CACHE_PATH = DATA_DIR / "graph_cache.json"
processor = MarkdownProcessor()

def generate_and_cache_graph():
    """
    Generate Nodes and Edges (including AI logic) and cache to JSON.
    Returns the generated dict.
    """
    nodes = []
    edges = []
    existing_files = set()
    
    try:
        # Step 1: Find all existing files (Nodes)
        for file_path in DATA_DIR.glob("**/*.md"):
            node_id = file_path.stem  # filename without .md
            existing_files.add(node_id)
            nodes.append({
                "id": node_id,
                "label": node_id,
                "group": "existing" # To colorize real notes vs ghost notes in UI
            })
            
        # Setup VectorDB early for Entity Resolution and Semantic Links
        vectordb = None
        db_path = Path(settings.paths.db_dir)
        if db_path.exists():
            embeddings = embedding_manager.get_embeddings()
            vectordb = Chroma(
                persist_directory=str(db_path),
                embedding_function=embeddings,
                collection_name=settings.vectordb.collection_name
            )

        # Step 2: Parse content to build connections (Edges)
        raw_ghost_nodes = set()
        
        for file_path in DATA_DIR.glob("**/*.md"):
            source_id = file_path.stem
            try:
                content = file_path.read_text(encoding='utf-8')
                # Reuse the regex extractor from MarkdownProcessor
                links = processor.extract_links(content)
                
                for target_id in links:
                    edges.append({
                        "source": source_id,
                        "target": target_id,
                        "type": "explicit"
                    })
                    
                    # Track "ghost notes" (linked but not yet created)
                    if target_id not in existing_files:
                        raw_ghost_nodes.add(target_id)
            except Exception as e:
                logger.warning(f"Could not parse file {file_path.name} for graph: {e}")
                
        # Step 3: Resolve Ghost Nodes (AI Entity Deduplication)
        ghost_nodes = set()
        alias_mapping = {}  # Map ghost note -> existing note
        
        if vectordb:
            # Threshold distance for considering two nodes as potential aliases. 
            # This is somewhat arbitrary and may require tuning based on embedding quality.
            ALIAS_DISTANCE = 0.45 
            
            for ghost in raw_ghost_nodes:
                # We query the ghost node text against the vector DB to find the closest existing node.
                results = vectordb.similarity_search_with_score(query=ghost, k=1)
                
                is_resolved = False
                if results:
                    doc, score = results[0]
                    if score <= ALIAS_DISTANCE:
                        filename = doc.metadata.get("filename")
                        if filename:
                            resolved_id = filename.replace('.md', '')
                            # Double-check that the resolved ID is indeed an existing file (sanity check)
                            if resolved_id in existing_files:
                                alias_mapping[ghost] = resolved_id
                                is_resolved = True
                                
                if not is_resolved:
                    ghost_nodes.add(ghost)
        else:
            ghost_nodes = raw_ghost_nodes
            
        # Update edges to point to resolved nodes where possible
        for edge in edges:
            if edge["target"] in alias_mapping:
                edge["target"] = alias_mapping[edge["target"]]
                
        # Add unresolved ghost nodes to the graph as well (they will appear as "ghost" group in UI)
        for ghost in ghost_nodes:
            nodes.append({
                "id": ghost,
                "label": ghost,
                "group": "ghost"
            })
            
        # --- Step 4: Add Semantic Links ---
        try:
            if vectordb:
                # We'll use a threshold distance. In Chroma, lower distance means higher similarity.
                # If embeddings are normalized, cosine distance = 1 - cosine similarity. 
                # Let's say distance < 0.6 is good enough.
                MAX_DISTANCE = 0.5
                MAX_SEMANTIC_LINKS = 2  # Don't clutter the graph too much per node
                
                # Check for semantic links between existing notes
                for file_path in DATA_DIR.glob("**/*.md"):
                    source_id = file_path.stem
                    content = file_path.read_text(encoding='utf-8')
                    # Use the first 500 chars to represent the document's central topic
                    query_text = content[:500] if len(content) > 0 else source_id
                    
                    # We query k=5 because chunks of the SAME document will likely fill the top spots.
                    results = vectordb.similarity_search_with_score(query=query_text, k=5)
                    
                    links_added = 0
                    for doc, score in results:
                        filename = doc.metadata.get("filename")
                        if filename:
                            target_id = filename.replace('.md', '')
                            # Only link if target is a DIFFERENT node, valid, and within distance
                            if target_id != source_id and target_id in existing_files and score <= MAX_DISTANCE:
                                # Ensure we don't have this edge as explicit already
                                is_explicit = any((e["source"] == source_id and e["target"] == target_id and e.get("type") == "explicit") for e in edges)
                                if not is_explicit:
                                    edges.append({
                                        "source": source_id,
                                        "target": target_id,
                                        "type": "semantic",
                                        "score": score
                                    })
                                    links_added += 1
                                    
                        if links_added >= MAX_SEMANTIC_LINKS:
                            break
                            
        except Exception as e:
            logger.warning(f"Could not generate semantic links: {e}")
            
        # Cache the result to file for quick GET access
        result = {
            "nodes": nodes,
            "edges": edges
        }
        try:
            # We save scores as float which are JSON serializable
            GRAPH_CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
            logger.info("Graph successfully generated and cached.")
        except Exception as e:
            logger.warning(f"Failed to write graph cache: {e}")
            
        return result
        
    except Exception as e:
        logger.error(f"Error generating graph data: {e}")
        return {"nodes": [], "edges": []}


@router.get("/")
def get_graph_data():
    """
    Instantly returns graph structure by reading from JSON cache.
    No heavy AI calculation done on-the-fly.
    """
    if GRAPH_CACHE_PATH.exists():
        try:
            content = GRAPH_CACHE_PATH.read_text(encoding='utf-8')
            return json.loads(content)
        except Exception as e:
            logger.error(f"Error reading graph cache file: {e}")
            
    # Fallback: If cache doesn't exist yet (first load or deleted),
    # generate it on the fly so the user doesn't see an empty graph.
    logger.info("Graph cache not found or corrupted. Generating on the fly...")
    return generate_and_cache_graph()

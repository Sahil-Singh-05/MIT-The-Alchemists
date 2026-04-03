import os
from dotenv import load_dotenv

load_dotenv()

# --- Groq ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL   = "llama-3.1-8b-instant"

# --- Embeddings ---
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # runs locally, free

# --- ChromaDB ---
CHROMA_PERSIST_DIR = "./chroma_db"
CHROMA_COLLECTION  = "sme_knowledge_base"

# --- Chunking ---
CHUNK_SIZE    = 500
CHUNK_OVERLAP = 50

# --- Retrieval ---
TOP_K_RESULTS = 5  # number of chunks to retrieve per query
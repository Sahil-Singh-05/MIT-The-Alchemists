import os

from dotenv import load_dotenv

load_dotenv()

# Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"

# Embeddings
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ChromaDB
CHROMA_PERSIST_DIR = "./chroma_db"
CHROMA_COLLECTION = "sme_knowledge_base"

# Auth / Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./alchemist.db")
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "alchemist_session")
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "7"))
ALCHEMIST_ADMIN_EMPLOYEE_IDS = os.getenv("ALCHEMIST_ADMIN_EMPLOYEE_IDS", "")
ALCHEMIST_ADMIN_EMAILS = os.getenv("ALCHEMIST_ADMIN_EMAILS", "")

# Chunking
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# Retrieval
TOP_K_RESULTS = 5

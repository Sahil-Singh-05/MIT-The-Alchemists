import hashlib

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from config import CHROMA_PERSIST_DIR, CHROMA_COLLECTION, EMBEDDING_MODEL, TOP_K_RESULTS


# --- ChromaDB client (persistent on disk) ---
_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
_embedding_fn = None


def _get_embedding_function():
    """
    Lazily create the embedding function so the API can boot without
    downloading the model during module import.
    """
    global _embedding_fn

    if _embedding_fn is None:
        try:
            _embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
        except Exception as exc:
            raise RuntimeError(
                "Unable to load the local embedding model "
                f"'{EMBEDDING_MODEL}'. Connect to the internet once so it can be "
                "downloaded, or make sure the model is already cached locally."
            ) from exc

    return _embedding_fn


def get_collection():
    return _client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=_get_embedding_function(),
        metadata={"hnsw:space": "cosine"},
    )


def _make_id(chunk: dict) -> str:
    """Deterministic ID from chunk content so re-ingestion doesn't duplicate."""
    key = f"{chunk['source']}_{chunk['text'][:80]}"
    return hashlib.md5(key.encode()).hexdigest()


def _sanitize_metadata(chunk: dict) -> dict:
    """
    ChromaDB metadata values must be str, int, or float.
    Convert everything else to string.
    """
    allowed = {}
    for k, v in chunk.items():
        if k == "text":
            continue
        if isinstance(v, (str, int, float, bool)):
            allowed[k] = v
        else:
            allowed[k] = str(v)
    return allowed


def add_chunks(chunks: list[dict]):
    """Embed and store chunks in ChromaDB."""
    collection = get_collection()

    ids       = []
    texts     = []
    metadatas = []

    for chunk in chunks:
        cid = _make_id(chunk)
        ids.append(cid)
        texts.append(chunk["text"])
        metadatas.append(_sanitize_metadata(chunk))

    if ids:
        # upsert = insert or update, so re-ingesting is safe
        collection.upsert(ids=ids, documents=texts, metadatas=metadatas)

    print(f"[VectorStore] Stored {len(ids)} chunks.")


def query_chunks(query_text: str, n_results: int = TOP_K_RESULTS) -> list[dict]:
    """
    Semantic search.
    Returns a list of result dicts with 'text', 'score', and all metadata fields.
    """
    collection = get_collection()

    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        output.append({
            "text"  : doc,
            "score" : round(1 - dist, 4),   # cosine similarity (higher = better)
            **meta,
        })

    return output


def clear_collection():
    """Wipe the collection (useful for re-ingestion during development)."""
    _client.delete_collection(CHROMA_COLLECTION)
    print("[VectorStore] Collection cleared.")


def collection_count() -> int:
    return get_collection().count()

from vectorstore.chroma_store import query_chunks
from config import TOP_K_RESULTS

# Minimum similarity score to consider a chunk relevant.
# Below this threshold = no relevant source found → refuse to answer.
RELEVANCE_THRESHOLD = 0.30


def retrieve(query: str, n_results: int = TOP_K_RESULTS) -> dict:
    """
    Retrieve relevant chunks for a query.

    Returns:
    {
        "has_results"  : bool,
        "chunks"       : list[dict],   # relevant chunks above threshold
        "low_score_msg": str           # set if no relevant chunks found
    }
    """
    chunks = query_chunks(query, n_results=n_results)

    # Filter by relevance threshold
    relevant = [c for c in chunks if c.get("score", 0) >= RELEVANCE_THRESHOLD]

    if not relevant:
        return {
            "has_results"  : False,
            "chunks"       : [],
            "low_score_msg": (
                "I could not find any relevant information in the knowledge base "
                "to answer this question. Please check with your manager or refer "
                "to the original documents directly."
            ),
        }

    return {
        "has_results"  : True,
        "chunks"       : relevant,
        "low_score_msg": "",
    }
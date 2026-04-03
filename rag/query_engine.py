"""
query_engine.py — Main RAG brain

Flow:
  user query
    → retrieve relevant chunks
    → if none: return "no source" error (no hallucination)
    → detect conflicts across chunks
    → build prompt with context + conflict note
    → call Groq Llama 3.1 8B
    → return structured answer with sources
"""

from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL
from rag.retriever import retrieve
from rag.conflict_detector import detect_conflicts

_client = Groq(api_key=GROQ_API_KEY)


def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a numbered context block for the prompt."""
    parts = []
    for i, c in enumerate(chunks, start=1):
        source_label = f"{c.get('source','?')}"
        if c.get("page"):
            source_label += f", page {c['page']}"
        elif c.get("row"):
            source_label += f", row {c['row']} (sheet: {c.get('sheet','?')})"
        elif c.get("subject"):
            source_label += f", subject: '{c.get('subject','?')}'"

        parts.append(
            f"[{i}] Source: {source_label} | Date: {c.get('date','?')}\n"
            f"{c['text']}"
        )
    return "\n\n".join(parts)


def _build_sources(chunks: list[dict]) -> list[dict]:
    """Build a clean source attribution list for the response."""
    sources = []
    for c in chunks:
        entry = {
            "file"  : c.get("source", "?"),
            "format": c.get("format", "?"),
            "date"  : c.get("date", "?"),
            "type"  : c.get("type", "?"),
        }
        if c.get("page"):
            entry["location"] = f"Page {c['page']}"
        elif c.get("row"):
            entry["location"] = f"Sheet '{c.get('sheet','?')}', Row {c['row']}"
        elif c.get("subject"):
            entry["location"] = f"Email: {c.get('subject','?')}"
        sources.append(entry)
    return sources


def ask(
    query: str,
    chat_history: list[dict] | None = None,
) -> dict:
    """
    Main entry point for the RAG agent.

    Args:
        query        : The employee's question
        chat_history : List of previous {"role": ..., "content": ...} messages

    Returns a dict:
    {
        "answer"          : str,         # LLM answer
        "sources"         : list[dict],  # source attribution
        "has_conflict"    : bool,
        "conflict_note"   : str,         # shown to user if conflict exists
        "has_answer"      : bool,        # False if no relevant docs found
        "no_answer_reason": str          # shown if has_answer=False
    }
    """
    chat_history = chat_history or []

    # Step 1: Retrieve
    retrieval = retrieve(query)

    if not retrieval["has_results"]:
        return {
            "answer"          : "",
            "sources"         : [],
            "has_conflict"    : False,
            "conflict_note"   : "",
            "has_answer"      : False,
            "no_answer_reason": retrieval["low_score_msg"],
        }

    chunks = retrieval["chunks"]

    # Step 2: Conflict detection
    conflict_result = detect_conflicts(query, chunks)
    has_conflict    = conflict_result["has_conflict"]
    conflict_note   = conflict_result["conflict_summary"]

    # Use all chunks for context but flag trusted chunk clearly
    context = _build_context(chunks)

    # If conflict: note which source to trust
    trust_note = ""
    if has_conflict and conflict_result["trusted_chunk"]:
        tc = conflict_result["trusted_chunk"]
        trust_note = (
            f"\nNOTE: A conflict was detected across sources. "
            f"Prioritise information from '{tc.get('source')}' "
            f"(dated {tc.get('date')}) as it is the most recent document."
        )

    # Step 3: Build prompt
    system_prompt = """You are a helpful internal knowledge assistant for a company.
Your job is to answer employee questions using ONLY the provided document excerpts.

Rules:
- Answer based strictly on the context provided. Do not make up information.
- If the context does not contain enough information, say so clearly.
- Always be concise and professional.
- Refer to sources naturally in your answer (e.g. "According to the refund_policy.pdf...").
- Do not repeat the source list at the end — that is handled separately."""

    user_message = f"""Context from company documents:
{context}
{trust_note}

Employee question: {query}

Answer based only on the above context:"""

    # Step 4: Call Groq with chat history for multi-turn context
    messages = [{"role": "system", "content": system_prompt}]
    messages += chat_history
    messages.append({"role": "user", "content": user_message})

    response = _client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=600,
    )

    answer = response.choices[0].message.content.strip()

    # Step 5: Build source attribution
    sources = _build_sources(chunks)

    return {
        "answer"          : answer,
        "sources"         : sources,
        "has_conflict"    : has_conflict,
        "conflict_note"   : conflict_note,
        "has_answer"      : True,
        "no_answer_reason": "",
    }
"""
query_engine.py — Main RAG brain (optimized prompts)
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
        source_label = c.get("source", "?")
        doc_type     = c.get("type", "prose")

        if c.get("page"):
            source_label += f", page {c['page']}"
        elif c.get("row"):
            source_label += f", row {c['row']} (sheet: {c.get('sheet','?')})"
        elif c.get("subject"):
            source_label += f", subject: '{c.get('subject','?')}'"

        # Label tabular data explicitly so the LLM treats it with precision
        type_tag = "[TABLE DATA]" if doc_type == "table" else "[EMAIL]" if doc_type == "email" else "[DOCUMENT]"

        parts.append(
            f"[{i}] {type_tag} Source: {source_label} | Date: {c.get('date','?')}\n"
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
        "answer"          : str,
        "sources"         : list[dict],
        "has_conflict"    : bool,
        "conflict_note"   : str,
        "has_answer"      : bool,
        "no_answer_reason": str
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

    context = _build_context(chunks)

    # Step 3: Trust note for conflict resolution
    trust_note = ""
    if has_conflict and conflict_result["trusted_chunk"]:
        tc = conflict_result["trusted_chunk"]
        trust_note = (
            f"\nIMPORTANT: A conflict exists across sources. "
            f"You MUST base your answer on '{tc.get('source')}' "
            f"(dated {tc.get('date')}) as it is the most recent and authoritative document. "
            f"Do not use conflicting information from older sources."
        )

    # Step 4: Optimized system prompt
    system_prompt = """You are an internal knowledge assistant for a company. \
Employees ask you questions and you answer using ONLY the provided document excerpts.

STRICT RULES:
1. Answer ONLY from the provided context. Never invent or assume information.
2. For TABLE DATA: treat every number, price, percentage, and date as exact — do not round or paraphrase figures.
3. For EMAILS: note the sender, date, and subject when relevant to the answer.
4. For DOCUMENTS: quote or closely reference the specific clause or section.
5. If the context does not contain enough information to answer confidently, say exactly: "I don't have enough information in the knowledge base to answer this question."
6. Be direct and concise. Lead with the answer, then cite the source naturally (e.g. "According to refund_policy.pdf...").
7. Do NOT repeat source citations at the end of your answer — they are displayed separately.
8. Do NOT use phrases like "based on the context provided" or "according to the excerpts" — just answer directly."""

    user_message = f"""--- COMPANY KNOWLEDGE BASE EXCERPTS ---
{context}
{trust_note}
--- END OF EXCERPTS ---

Employee question: {query}

Answer:"""

    # Step 5: Call Groq with last 3 turns of history to avoid token overflow
    messages = [{"role": "system", "content": system_prompt}]
    messages += chat_history[-6:]
    messages.append({"role": "user", "content": user_message})

    response = _client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.1,   # lower = more factual
        max_tokens=800,    # increased to avoid cut-off answers
    )

    answer = response.choices[0].message.content.strip()

    # Step 6: Build source attribution
    sources = _build_sources(chunks)

    return {
        "answer"          : answer,
        "sources"         : sources,
        "has_conflict"    : has_conflict,
        "conflict_note"   : conflict_note,
        "has_answer"      : True,
        "no_answer_reason": "",
    }
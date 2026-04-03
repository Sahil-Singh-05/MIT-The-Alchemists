from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL


_client = Groq(api_key=GROQ_API_KEY)


def detect_conflicts(query: str, chunks: list[dict]) -> dict:
    """
    Given a query and retrieved chunks, detect if any chunks contradict each other.

    Returns:
    {
        "has_conflict"     : bool,
        "conflict_summary" : str,        # human-readable explanation
        "trusted_chunk"    : dict | None, # the chunk we should trust (newest date)
        "all_chunks"       : list[dict]  # original chunks for reference
    }
    """
    if len(chunks) <= 1:
        return {
            "has_conflict"    : False,
            "conflict_summary": "",
            "trusted_chunk"   : chunks[0] if chunks else None,
            "all_chunks"      : chunks,
        }

    # Build a summary of each chunk for the LLM to compare
    chunk_summaries = []
    for i, c in enumerate(chunks):
        chunk_summaries.append(
            f"[Chunk {i+1}] Source: {c.get('source','?')} | "
            f"Date: {c.get('date','?')} | "
            f"Content: {c['text'][:300]}"
        )

    prompt = f"""You are a conflict detection assistant for a company knowledge base.

A user asked: "{query}"

The following chunks were retrieved from different documents:

{chr(10).join(chunk_summaries)}

Your job:
1. Identify if any two chunks CONTRADICT each other on a factual claim relevant to the query.
2. If there is a conflict, say which chunks conflict and what the contradiction is.
3. Reply ONLY in this exact JSON format (no markdown, no explanation outside JSON):

{{
  "has_conflict": true or false,
  "conflicting_chunks": [1, 2],
  "conflict_description": "short description of what contradicts"
}}

If no conflict, reply:
{{
  "has_conflict": false,
  "conflicting_chunks": [],
  "conflict_description": ""
}}"""

    response = _client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=300,
    )

    import json, re
    raw = response.choices[0].message.content.strip()

    # Extract JSON safely
    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        result = json.loads(match.group()) if match else {}
    except Exception:
        result = {}

    has_conflict = result.get("has_conflict", False)
    conflict_desc = result.get("conflict_description", "")
    conflicting_indices = result.get("conflicting_chunks", [])  # 1-indexed

    # --- Resolve conflict: pick the chunk with the latest date ---
    trusted_chunk = None
    conflict_summary = ""

    if has_conflict and conflicting_indices:
        # Get the actual conflicting chunks (convert 1-index to 0-index)
        conflicting = []
        for idx in conflicting_indices:
            try:
                conflicting.append(chunks[idx - 1])
            except IndexError:
                pass

        if conflicting:
            # Sort by date descending, pick newest
            trusted_chunk = sorted(
                conflicting,
                key=lambda c: c.get("date", "0000-00-00"),
                reverse=True
            )[0]

            older = [c for c in conflicting if c is not trusted_chunk]
            older_sources = ", ".join(
                f"{c.get('source','?')} ({c.get('date','?')})" for c in older
            )

            conflict_summary = (
                f"⚠️ Conflict detected: {conflict_desc} "
                f"Trusting '{trusted_chunk.get('source','?')}' "
                f"(dated {trusted_chunk.get('date','?')}) "
                f"over {older_sources} because it is more recent."
            )
    else:
        # No conflict — pick highest scoring chunk as trusted
        trusted_chunk = max(chunks, key=lambda c: c.get("score", 0))

    return {
        "has_conflict"    : has_conflict,
        "conflict_summary": conflict_summary,
        "trusted_chunk"   : trusted_chunk,
        "all_chunks"      : chunks,
    }
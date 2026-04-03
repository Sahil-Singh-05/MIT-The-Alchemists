from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import CHUNK_SIZE, CHUNK_OVERLAP


_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_documents(raw_chunks: list[dict]) -> list[dict]:
    """
    Takes raw chunks from any parser.
    - Table rows and emails are already atomic — pass through unchanged.
    - Prose chunks (PDF pages) may be long — split them further.

    Every output chunk preserves all original metadata fields.
    """
    final_chunks = []

    for chunk in raw_chunks:
        doc_type = chunk.get("type", "prose")

        # Table rows and emails: already one semantic unit — don't split
        if doc_type in ("table", "email"):
            final_chunks.append(chunk)
            continue

        # Prose: split into smaller pieces
        sub_texts = _splitter.split_text(chunk["text"])
        for i, sub in enumerate(sub_texts):
            new_chunk = {**chunk}          # copy all metadata
            new_chunk["text"]        = sub
            new_chunk["chunk_index"] = i   # track position within original page
            final_chunks.append(new_chunk)

    return final_chunks
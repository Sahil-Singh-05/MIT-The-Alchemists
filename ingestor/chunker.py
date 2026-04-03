from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import CHUNK_SIZE, CHUNK_OVERLAP


_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_documents(raw_chunks: list[dict], source_name: str = None) -> list[dict]:
    final_chunks = []
    for chunk in raw_chunks:
        doc_type = chunk.get("type", "prose")

        if doc_type in ("table", "email"):
            new_chunk = {**chunk}
            if source_name:
                new_chunk["source"] = source_name  # ← override temp path
            final_chunks.append(new_chunk)
            continue

        sub_texts = _splitter.split_text(chunk["text"])
        for i, sub in enumerate(sub_texts):
            new_chunk = {**chunk}
            new_chunk["text"]        = sub
            new_chunk["chunk_index"] = i
            if source_name:
                new_chunk["source"] = source_name  # ← override temp path
            final_chunks.append(new_chunk)

    return final_chunks 
# The Alchemist

The Alchemist is a full-stack internal knowledge assistant for small and medium-sized business operations. It lets teams upload business documents, ask grounded questions through a RAG chatbot, and turn support conversations into CRM-style tickets for admin follow-up.

Built with a React frontend, FastAPI backend, ChromaDB vector search, Supabase authentication, and Groq-powered language generation, the project demonstrates an end-to-end AI workflow: document ingestion, semantic retrieval, source-aware answers, admin knowledge-base management, and operational ticket tracking.

## Live Demo

**Link**: https://the-alchemists-eight.vercel.app/

For testing purposes:
- **Normal User**: Email - testuser@gmail.com, Password - 12345678
- **Admin**: Email - testadmin@gmail.com, Password - 87654321

Sample documents are already uploaded and indexed. You can start querying immediately after logging in. Check `sample_docs/` for the documents used.

## Screenshots

### User Landing Screen

![User Landing Page](screenshots/Landing%20Page.png)

### RAG Chat With Sources

![RAG chat with source citations](screenshots/RAG%20Chat%20Answer%20With%20Sources.png)

### Search History

![Chat History](screenshots/Search%20History.png)

### Admin Upload Dashboard

![Admin upload and document dashboard](screenshots/Admin%20Upload%20Documents.png)

### Admin Tickets Dashboard

![Support ticket dashboard](screenshots/Admin%20Tickets-1.png)

### Ticket Detail Page

![Generated Tickets from Conversation](screenshots/Admin%20Tickets-2.png)

## Highlights

- **Multi-format knowledge ingestion**: Upload and index PDF, Excel, and email files.
- **RAG chatbot**: Ask questions against uploaded company documents with source attribution.
- **Spreadsheet-aware retrieval**: Excel rows are parsed into structured table chunks for product, pricing, policy, and operational queries.
- **Conversation-aware follow-ups**: Follow-up questions can use prior chat context so users can ask naturally.
- **Conflict-aware answering**: Retrieved chunks are checked for conflicting facts and the assistant can prefer the newest trusted source.
- **Role-based workspace**: Employees get chat, search, and ticket views; admins get upload, document, and ticket management.
- **Automatic support tickets**: Chat conversations can be converted into CRM tickets with the original questions, AI answers, sources, user identity, and summary metadata.
- **Production-oriented deployment**: Frontend is configured for Vercel, backend for Railway.

## Demo Workflow

1. An admin uploads company documents such as pricing sheets, policy PDFs, or email records.
2. The backend parses the file, chunks the content, embeds it, and stores it in ChromaDB.
3. An employee asks a question in the chat workspace.
4. The RAG engine retrieves relevant chunks, checks for conflicts, and asks the LLM to answer only from retrieved context.
5. The frontend displays the answer with source chips.
6. The conversation can be turned into a support ticket for admin review.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, Supabase JS |
| Backend | FastAPI, Pydantic, SQLAlchemy |
| Auth | Supabase JWT validation, role-based access |
| RAG | ChromaDB, Sentence Transformers, LangChain text splitting |
| LLM | Groq API |
| Parsing | PyMuPDF, pdfplumber, pandas, openpyxl, Python email utilities |
| Database | SQLite locally, configurable via `DATABASE_URL` |
| Deployment | Vercel frontend, Railway backend |

## Architecture

```text
Employee/Admin UI (React + Vite)
        |
        | REST API + Supabase bearer token
        v
FastAPI backend
        |
        |-- Auth and role checks
        |-- Chat sessions and CRM tickets
        |-- Admin upload/document APIs
        |
        v
Ingestion pipeline
        |
        |-- PDF parser
        |-- Excel parser
        |-- Email parser
        |-- Chunker
        |
        v
ChromaDB vector store + metadata
        |
        v
RAG query engine
        |
        |-- Semantic retrieval
        |-- Conflict detection
        |-- Source-aware prompt
        |
        v
Groq LLM response
```

## Run Locally

```bash
# Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT License - feel free to use this project for learning and reference.

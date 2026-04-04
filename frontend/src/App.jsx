import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const MESSAGE_META_STORAGE_KEY = "the-alchemists-message-meta-v1";
const ADMIN_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const ASSETS = {
  brand: "/assets/image-Photoroom.png",
  brandWordmark: "/assets/image-Photoroom(10).png",
  search: "/assets/image-Photoroom(1).png",
  profile: "/assets/image-Photoroom(6).png",
  message: "/assets/image-Photoroom(8).png",
  ticket: "/assets/image-Photoroom(9).png",
};

const NAV_ITEMS = [
  { id: "chat", label: "New Chat", icon: ASSETS.message },
  { id: "search", label: "Search Chat", icon: ASSETS.search },
  { id: "tickets", label: "Tickets", icon: ASSETS.ticket, accent: true },
];

const ADMIN_NAV_ITEMS = [
  { id: "uploads", label: "Uploads", icon: ASSETS.message },
  { id: "tickets", label: "Tickets", icon: ASSETS.ticket },
];

const ADMIN_FILTERS = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF" },
  { id: "excel", label: "XLSX" },
  { id: "email", label: "Email" },
];

const SHOWCASE_RECENTS = [
  { id: "mock-hackathon", title: "Hackathon Problem", placeholder: true },
  { id: "mock-anaconda", title: "Anaconda Setup", placeholder: true },
];

const ADMIN_MOCK_DOCUMENTS = [
  {
    id: "admin-doc-1",
    name: "Company Policy.pdf",
    type: "pdf",
    size: "1.8 MB",
    uploadedBy: "Admin",
    uploadDate: "Aug 6, 2024",
    category: "HR / Policy",
    description:
      "This document covers organizational policy updates, reimbursement notes, and employee support workflow references for the admin knowledge base.",
  },
  {
    id: "admin-doc-2",
    name: "Pricing.xlsx",
    type: "excel",
    size: "183 KB",
    uploadedBy: "Admin",
    uploadDate: "Sep 12, 2024",
    category: "Finance / Report",
    description:
      "Contains pricing models, quarterly planning sheets, and spreadsheet tabs used to answer internal finance questions.",
  },
  {
    id: "admin-doc-3",
    name: "HR Threads.eml",
    type: "email",
    size: "510 KB",
    uploadedBy: "Admin",
    uploadDate: "Oct 2, 2024",
    category: "Inbox / Email",
    description:
      "Email archive containing policy confirmations and operational clarifications that can be cited in grounded responses.",
  },
  {
    id: "admin-doc-4",
    name: "Refund Policy.pdf",
    type: "pdf",
    size: "2.4 MB",
    uploadedBy: "Admin",
    uploadDate: "Jul 17, 2024",
    category: "Customer / Policy",
    description:
      "Details refund timelines, case-management rules, and policy exceptions for support and operations teams.",
  },
];

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = "Request failed.";

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      detail = response.statusText || detail;
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function readStoredMessageMeta() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MESSAGE_META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredMessageMeta(value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MESSAGE_META_STORAGE_KEY, JSON.stringify(value));
}

function hydrateMessages(sessionId, history, latestAssistantMeta = null) {
  const storedMeta = readStoredMessageMeta();
  const normalized = history.map((message) => ({
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  }));

  if (latestAssistantMeta) {
    const lastAssistantIndex = [...normalized]
      .map((message) => message.role)
      .lastIndexOf("assistant");

    if (lastAssistantIndex >= 0) {
      storedMeta[`${sessionId}:${normalized[lastAssistantIndex].timestamp}`] = latestAssistantMeta;
      saveStoredMessageMeta(storedMeta);
    }
  }

  return normalized.map((message) => ({
    ...message,
    ...(storedMeta[`${sessionId}:${message.timestamp}`] ?? {}),
  }));
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTicketDate(timestamp) {
  if (!timestamp) {
    return "Pending";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function truncateLabel(value, maxLength = 20) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function humanizeError(error) {
  return error instanceof Error ? error.message : "The backend is not responding yet.";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function resolveAdminDocumentType(fileName) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (lowerName.endsWith(".eml")) {
    return "email";
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return "excel";
  }

  return "";
}

function getAdminDocumentIcon(type) {
  if (type === "pdf") {
    return "fa-file-pdf-o";
  }

  if (type === "excel") {
    return "fa-file-excel-o";
  }

  if (type === "email") {
    return "fa-envelope-o";
  }

  return "fa-file-o";
}

function createMockPreviewMarkup(doc) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(doc.name)}</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        background: #efe2fb;
        color: #2d2357;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }
      .viewer {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        border: 2px solid #b174e7;
        border-radius: 24px;
        padding: 28px;
      }
      h1 {
        margin: 0 0 12px;
        color: #43348b;
        font-size: 30px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }
      .meta-item {
        background: #f7f1ff;
        border: 1px solid #dbc9f7;
        border-radius: 14px;
        padding: 14px 16px;
      }
      .label {
        font-size: 12px;
        color: #6f63a7;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .value {
        font-size: 16px;
        font-weight: 700;
      }
      .content {
        background: #fbf8ff;
        border: 1px solid #e5daf7;
        border-radius: 16px;
        padding: 20px;
        font-size: 16px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="viewer">
      <h1>${escapeHtml(doc.name)}</h1>
      <div class="meta">
        <div class="meta-item">
          <div class="label">Type</div>
          <div class="value">${escapeHtml(doc.type.toUpperCase())}</div>
        </div>
        <div class="meta-item">
          <div class="label">Category</div>
          <div class="value">${escapeHtml(doc.category)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Uploaded By</div>
          <div class="value">${escapeHtml(doc.uploadedBy)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Upload Date</div>
          <div class="value">${escapeHtml(doc.uploadDate)}</div>
        </div>
      </div>
      <div class="content">${escapeHtml(doc.description)}</div>
    </div>
  </body>
</html>`;
}

function TypingBubble() {
  return (
    <div className="typing-bubble" aria-label="Assistant is thinking">
      <span />
      <span />
      <span />
    </div>
  );
}

function App() {
  const [role, setRole] = useState("employee");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState("chat");
  const [sessions, setSessions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hasActivatedSearch, setHasActivatedSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState("");
  const [adminView, setAdminView] = useState("uploads");
  const [adminDocuments, setAdminDocuments] = useState([]);
  const [adminFilter, setAdminFilter] = useState("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [isAdminUploading, setIsAdminUploading] = useState(false);
  const [adminUploadProgress, setAdminUploadProgress] = useState(0);
  const composerInputRef = useRef(null);
  const endRef = useRef(null);
  const adminObjectUrlsRef = useRef(new Set());

  const deferredQuery = useDeferredValue(query);
  const visibleSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );
  const recentSessions = sessions.length
    ? sessions.slice(0, 2).map((session) => ({ ...session, placeholder: false }))
    : SHOWCASE_RECENTS;
  const filteredAdminDocuments = useMemo(() => {
    return adminDocuments
      .filter((doc) => (adminFilter === "all" ? true : doc.type === adminFilter))
      .filter((doc) => doc.name.toLowerCase().includes(adminSearch.trim().toLowerCase()));
  }, [adminDocuments, adminFilter, adminSearch]);
  const isLanding = activeView === "chat" && messages.length === 0 && !isLoadingSession;

  function registerAdminObjectUrl(url) {
    if (url?.startsWith("blob:")) {
      adminObjectUrlsRef.current.add(url);
    }

    return url;
  }

  function revokeAdminObjectUrl(url) {
    if (adminObjectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      adminObjectUrlsRef.current.delete(url);
    }
  }

  function buildAdminPreviewUrl(doc) {
    const blob = new Blob([createMockPreviewMarkup(doc)], { type: "text/html" });
    return registerAdminObjectUrl(URL.createObjectURL(blob));
  }

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const [sessionData, ticketData] = await Promise.all([
          apiRequest("/chat/sessions").catch(() => []),
          apiRequest("/crm/tickets").catch(() => []),
        ]);

        if (ignore) {
          return;
        }

        startTransition(() => {
          setSessions(sessionData);
          setTickets(ticketData);
        });
      } finally {
        if (!ignore) {
          setIsBooting(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeView, isSubmitting]);

  useEffect(() => {
    const input = composerInputRef.current;

    if (!input) {
      return;
    }

    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
  }, [draft, activeView, messages.length]);

  useEffect(() => {
    const seededDocuments = ADMIN_MOCK_DOCUMENTS.map((doc) => ({
      ...doc,
      previewUrl: buildAdminPreviewUrl(doc),
    }));

    setAdminDocuments(seededDocuments);
  }, []);

  useEffect(() => {
    return () => {
      adminObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      adminObjectUrlsRef.current.clear();
    };
  }, []);

  async function refreshSessions() {
    try {
      const sessionData = await apiRequest("/chat/sessions");
      startTransition(() => {
        setSessions(sessionData);
      });
    } catch (refreshError) {
      setError(humanizeError(refreshError));
    }
  }

  async function openSession(sessionId) {
    setError("");
    setActiveView("chat");
    setCurrentSessionId(sessionId);
    setIsLoadingSession(true);

    try {
      const history = await apiRequest(`/chat/session/${sessionId}`);
      setMessages(hydrateMessages(sessionId, history));
    } catch (sessionError) {
      setMessages([]);
      setError(humanizeError(sessionError));
    } finally {
      setIsLoadingSession(false);
    }
  }

  function handleNewChat() {
    setActiveView("chat");
    setCurrentSessionId(null);
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const question = draft.trim();

    if (!question || isSubmitting) {
      return;
    }

    const pendingTimestamp = new Date().toISOString();
    let sessionId = currentSessionId;

    setActiveView("chat");
    setError("");
    setDraft("");
    setIsSubmitting(true);
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: question,
        timestamp: pendingTimestamp,
        isPending: true,
      },
    ]);

    try {
      if (!sessionId) {
        const session = await apiRequest("/chat/session", {
          method: "POST",
          body: JSON.stringify({ title: "New Chat" }),
        });
        sessionId = session.id;
        setCurrentSessionId(sessionId);
      }

      const answer = await apiRequest("/chat/ask", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          question,
        }),
      });

      const history = await apiRequest(`/chat/session/${sessionId}`);
      setMessages(
        hydrateMessages(sessionId, history, {
          question,
          sources: answer.sources,
          hasConflict: answer.has_conflict,
          conflictNote: answer.conflict_note,
          hasAnswer: answer.has_answer,
          noAnswerReason: answer.no_answer_reason,
        }),
      );
      await refreshSessions();
    } catch (submitError) {
      setMessages((previous) => [
        ...previous.map((message) =>
          message.timestamp === pendingTimestamp ? { ...message, isPending: false } : message,
        ),
        {
          role: "assistant",
          content: humanizeError(submitError),
          timestamp: new Date().toISOString(),
          isError: true,
        },
      ]);
      setError(humanizeError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleSidebarClick(event) {
    if (sidebarOpen) {
      return;
    }

    if (event.target.closest("button")) {
      return;
    }

    setSidebarOpen(true);
  }

  function handleSearchInputChange(event) {
    const nextQuery = event.target.value;

    setQuery(nextQuery);

    if (nextQuery.trim()) {
      setHasActivatedSearch(true);
    }
  }

  function handleEnterAdminMode() {
    setRole("admin");
    setSidebarOpen(true);
    setAdminView("uploads");
    setError("");
  }

  function handleExitAdminMode() {
    setRole("employee");
    setError("");
  }

  function handleAdminFilesAdded(fileList) {
    if (isAdminUploading) {
      return;
    }

    const files = Array.from(fileList ?? []);

    if (!files.length) {
      return;
    }

    const acceptedFiles = files.filter(
      (file) => resolveAdminDocumentType(file.name) && file.size <= ADMIN_MAX_UPLOAD_BYTES,
    );

    if (!acceptedFiles.length) {
      setError("Admins can upload PDF, Excel, or email files up to 200 MB.");
      return;
    }

    setError(
      acceptedFiles.length === files.length
        ? ""
        : "Some files were skipped. Admin uploads currently accept PDF, Excel, or email files up to 200 MB.",
    );
    setIsAdminUploading(true);
    setAdminUploadProgress(0);

    const process = window.setInterval(() => {
      setAdminUploadProgress((previous) => {
        const next = Math.min(previous + 20, 100);

        if (next === 100) {
          window.clearInterval(process);

          const uploadedOn = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date());

          const newDocs = acceptedFiles.map((file, index) => {
            const type = resolveAdminDocumentType(file.name);

            return {
              id: `admin-upload-${Date.now()}-${index}`,
              name: file.name,
              type,
              size: formatFileSize(file.size),
              uploadedBy: "Admin",
              uploadDate: uploadedOn,
              category:
                type === "pdf" ? "Policy / PDF" : type === "excel" ? "Data / Excel" : "Inbox / Email",
              description: "Uploaded file preview opens in a new tab using the browser viewer.",
              previewUrl: registerAdminObjectUrl(URL.createObjectURL(file)),
            };
          });

          startTransition(() => {
            setAdminDocuments((previousDocs) => [...newDocs, ...previousDocs]);
          });

          window.setTimeout(() => {
            setIsAdminUploading(false);
            setAdminUploadProgress(0);
          }, 220);
        }

        return next;
      });
    }, 80);
  }

  function handleAdminFileInputChange(event) {
    handleAdminFilesAdded(event.target.files);
    event.target.value = "";
  }

  function handleAdminDocumentOpen(doc) {
    if (!doc?.previewUrl) {
      setError("Preview unavailable for this document.");
      return;
    }

    window.open(doc.previewUrl, "_blank", "noopener,noreferrer");
  }

  function renderComposer(isCompact = false) {
    return (
      <form
        className={`composer ${isCompact ? "composer--compact" : ""}`}
        onSubmit={handleSubmit}
      >
        <img alt="" className="composer__icon composer__icon--left" src={ASSETS.search} />
        <textarea
          className="composer__input"
          ref={composerInputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={isLanding ? "" : "Ask the knowledge base anything..."}
          rows={1}
        />
        <button
          className="composer__submit"
          type="submit"
          disabled={!draft.trim() || isSubmitting}
          aria-label="Send message"
        >
          <img alt="" src={ASSETS.message} />
        </button>
      </form>
    );
  }

  function renderSearchShell(isDocked = false) {
    return (
      <label className={`search-shell ${isDocked ? "search-shell--docked" : ""}`}>
        <img alt="" src={ASSETS.search} />
        <input
          type="text"
          value={query}
          onChange={handleSearchInputChange}
          placeholder="Search by session title..."
        />
      </label>
    );
  }

  function renderChatView() {
    if (isLanding) {
      return (
        <section className="landing">
          <div className="landing__brand">
            <img alt="The Alchemists flask" className="landing__logo" src={ASSETS.brand} />
            <h1>ALCHEMIST</h1>
          </div>
          <div className="landing__composer">{renderComposer()}</div>
        </section>
      );
    }

    return (
      <section className="chat-view">
        <div className="chat-view__scroll">
          {isLoadingSession ? (
            <div className="empty-card empty-card--loading">
              <TypingBubble />
              <p>Loading session...</p>
            </div>
          ) : null}

          {!isLoadingSession
            ? messages.map((message, index) => (
                <article
                  key={`${message.timestamp}-${index}`}
                  className={`message-card message-card--${message.role} ${
                    message.isError ? "message-card--error" : ""
                  }`}
                >
                  <div className="message-card__meta">
                    <span>{message.role === "user" ? "You" : "Alchemist"}</span>
                    <time>{formatTimestamp(message.timestamp)}</time>
                  </div>
                  <p>{message.content}</p>

                  {message.role === "assistant" && message.hasConflict ? (
                    <div className="message-card__note">{message.conflictNote}</div>
                  ) : null}

                  {message.role === "assistant" && message.sources?.length ? (
                    <div className="sources">
                      {[...new Map(message.sources.map((source) => [source.file, source])).values()].map(
                        (source) => (
                          <span
                            className="source-chip"
                            key={`${source.file}-${source.location}-${source.date}`}
                          >
                            {source.file}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                </article>
              ))
            : null}

          {isSubmitting ? (
            <article className="message-card message-card--assistant message-card--typing">
              <div className="message-card__meta">
                <span>Alchemist</span>
                <time>Now</time>
              </div>
              <TypingBubble />
            </article>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="chat-view__composer">{renderComposer(true)}</div>
      </section>
    );
  }

  function renderSearchView() {
    return (
      <section
        className={`panel-view panel-view--search ${
          hasActivatedSearch ? "panel-view--search-active" : ""
        }`}
      >
        <header className="panel-view__header">
          <p>Search Chat</p>
          <span>Find prior RAG conversations and jump back in.</span>
        </header>

        {!hasActivatedSearch ? renderSearchShell() : null}

        <div className="panel-view__scroll">
          <div className="panel-grid">
            {visibleSessions.length ? (
              visibleSessions.map((session) => (
                <button
                  className="panel-card"
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span>{session.message_count} messages</span>
                  <small>{formatTicketDate(session.created_at)}</small>
                </button>
              ))
            ) : (
              <div className="empty-card">
                <p>No matching chats yet.</p>
              </div>
            )}
          </div>
        </div>

        {hasActivatedSearch ? renderSearchShell(true) : null}
      </section>
    );
  }

  function renderTicketsView() {
    return (
      <section className="panel-view">
        <header className="panel-view__header">
          <p>Tickets</p>
          <span>Auto-filled support tickets created from grounded answers.</span>
        </header>

        <div className="panel-grid">
          {tickets.length ? (
            tickets.map((ticket) => (
              <article className="ticket-card" key={ticket.ticket_id}>
                <div className="ticket-card__header">
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.status}</span>
                </div>
                <p>{ticket.client_name}</p>
                <small>
                  {ticket.ticket_id} | {ticket.priority} | {formatTicketDate(ticket.created_at)}
                </small>
                <div className="sources">
                  {[...new Set(ticket.sources_cited)].map((source) => (
                    <span className="source-chip source-chip--ticket" key={source}>
                      {source}
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="empty-card">
              <p>No tickets yet.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderAdminUploadsView() {
    return (
      <section className="admin-dashboard">
        <header className="admin-dashboard__topbar">
          <h1>Upload Documents</h1>

          <button className="admin-logout" type="button" onClick={handleExitAdminMode}>
            <span>LOGOUT</span>
            <i className="fa fa-sign-out" aria-hidden="true" />
          </button>
        </header>

        <label className={`admin-upload-card ${isAdminUploading ? "is-uploading" : ""}`}>
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.eml"
            onChange={handleAdminFileInputChange}
          />
          <span className="admin-upload-card__icon" aria-hidden="true">
            <i className="fa fa-upload" />
          </span>
          <strong>Choose Files</strong>
          <span>(only PDF / Excel / Email)</span>
          <small>Limit 200MB per file</small>

          {isAdminUploading ? (
            <div className="admin-upload-card__progress">
              <div
                className="admin-upload-card__progress-bar"
                style={{ width: `${adminUploadProgress}%` }}
              />
            </div>
          ) : null}
        </label>

        <section className="admin-library">
          <div className="admin-library__tools">
            <label className="admin-search">
              <i className="fa fa-search" aria-hidden="true" />
              <input
                type="text"
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Search documents"
              />
            </label>

            <div className="admin-filters">
              {ADMIN_FILTERS.map((filterItem) => (
                <button
                  className={adminFilter === filterItem.id ? "is-active" : ""}
                  key={filterItem.id}
                  type="button"
                  onClick={() => setAdminFilter(filterItem.id)}
                >
                  {filterItem.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-doc-list">
            {filteredAdminDocuments.length ? (
              filteredAdminDocuments.map((doc) => (
                <article className="admin-doc-row" key={doc.id}>
                  <div className="admin-doc-row__meta">
                    <span className={`admin-doc-row__icon admin-doc-row__icon--${doc.type}`}>
                      <i className={`fa ${getAdminDocumentIcon(doc.type)}`} aria-hidden="true" />
                    </span>
                    <span className="admin-doc-row__name">{doc.name}</span>
                  </div>

                  <button type="button" onClick={() => handleAdminDocumentOpen(doc)}>
                    View
                  </button>
                </article>
              ))
            ) : (
              <div className="admin-empty-state">
                <p>No admin documents match this filter yet.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    );
  }

  function renderAdminTicketsView() {
    return (
      <section className="admin-dashboard">
        <header className="admin-dashboard__topbar">
          <h1>Tickets</h1>

          <button className="admin-logout" type="button" onClick={handleExitAdminMode}>
            <span>LOGOUT</span>
            <i className="fa fa-sign-out" aria-hidden="true" />
          </button>
        </header>

        <section className="admin-library admin-library--tickets">
          <div className="admin-ticket-list">
            {isBooting ? (
              <div className="admin-empty-state">
                <p>Loading tickets...</p>
              </div>
            ) : tickets.length ? (
              tickets.map((ticket) => (
                <article className="admin-ticket-row" key={ticket.ticket_id}>
                  <div className="admin-ticket-row__main">
                    <strong>{ticket.subject}</strong>
                    <span>{ticket.client_name}</span>
                  </div>

                  <div className="admin-ticket-row__meta">
                    <span>{ticket.status}</span>
                    <small>
                      {ticket.ticket_id} | {formatTicketDate(ticket.created_at)}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <div className="admin-empty-state">
                <p>No tickets yet.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    );
  }

  function renderAdminShell() {
    return (
      <div className={`admin-shell ${sidebarOpen ? "admin-shell--open" : "admin-shell--collapsed"}`}>
        <aside
          className={`admin-sidebar ${sidebarOpen ? "admin-sidebar--open" : "admin-sidebar--collapsed"}`}
          onClick={handleSidebarClick}
        >
          <div>
            <div className="admin-sidebar__top">
              <div className="admin-sidebar__brand">
                <img alt="The Alchemists" src={ASSETS.brand} />
                <span>ALCHEMIST</span>
              </div>
            </div>

            <nav className="admin-sidebar__nav">
              {ADMIN_NAV_ITEMS.map((item) => (
                <button
                  className={`admin-sidebar__nav-item ${adminView === item.id ? "is-active" : ""}`}
                  key={item.id}
                  type="button"
                  onClick={() => setAdminView(item.id)}
                >
                  <img alt="" src={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="admin-sidebar__profile">
            <img alt="" src={ASSETS.profile} />
            <span>Admin</span>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            aria-label="Collapse admin sidebar"
            className="sidebar-scrim"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="admin-workspace">
          {error ? <div className="admin-notice">{error}</div> : null}
          {adminView === "uploads" ? renderAdminUploadsView() : renderAdminTicketsView()}
        </main>
      </div>
    );
  }

  function renderEmployeeShell() {
    return (
      <div className={`app-shell ${sidebarOpen ? "app-shell--open" : "app-shell--collapsed"}`}>
        <aside
          className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--collapsed"}`}
          onClick={handleSidebarClick}
        >
          <div className="sidebar__top">
            <button className="sidebar__brand" type="button" onClick={handleNewChat}>
              <img alt="The Alchemists" src={ASSETS.brand} />
            </button>
            <img alt="Alchemist" className="sidebar__wordmark" src={ASSETS.brandWordmark} />
          </div>

          <nav className="sidebar__nav">
            {NAV_ITEMS.map((item) => (
              <button
                className={`sidebar__nav-item ${activeView === item.id ? "is-active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "chat") {
                    handleNewChat();
                    return;
                  }

                  setActiveView(item.id);
                  setError("");
                }}
              >
                <img
                  alt=""
                  className={
                    item.accent ? "sidebar__nav-icon sidebar__nav-icon--accent" : "sidebar__nav-icon"
                  }
                  src={item.icon}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar__section">
            <div className="sidebar__section-header">
              <span>Recents</span>
              <small>v</small>
            </div>

            <div className="sidebar__recents">
              {recentSessions.map((session) => (
                <button
                  className="sidebar__recent"
                  disabled={session.placeholder}
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                >
                  {truncateLabel(session.title, 22)}
                </button>
              ))}
            </div>
          </div>

          <button className="sidebar__role-switch" type="button" onClick={handleEnterAdminMode}>
            <img alt="" src={ASSETS.brand} />
            <span>Admin Mode</span>
          </button>

          <div className="sidebar__profile">
            <img alt="" src={ASSETS.profile} />
            <span>Sahil Singh</span>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            aria-label="Collapse sidebar"
            className="sidebar-scrim"
            type="button"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="workspace">
          {error ? <div className="workspace__notice">{error}</div> : null}
          {isBooting ? <div className="workspace__status">Loading workspace...</div> : null}

          {activeView === "chat" ? renderChatView() : null}
          {activeView === "search" ? renderSearchView() : null}
          {activeView === "tickets" ? renderTicketsView() : null}
        </main>
      </div>
    );
  }

  return role === "admin" ? renderAdminShell() : renderEmployeeShell();
}

export default App;

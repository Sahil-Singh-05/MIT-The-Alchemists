import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const MESSAGE_META_STORAGE_KEY = "the-alchemists-message-meta-v1";

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

const SHOWCASE_RECENTS = [
  { id: "mock-hackathon", title: "Hackathon Problem", placeholder: true },
  { id: "mock-anaconda", title: "Anaconda Setup", placeholder: true },
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
  const composerInputRef = useRef(null);
  const endRef = useRef(null);

  const deferredQuery = useDeferredValue(query);
  const visibleSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );
  const recentSessions = sessions.length
    ? sessions.slice(0, 2).map((session) => ({ ...session, placeholder: false }))
    : SHOWCASE_RECENTS;
  const isLanding = activeView === "chat" && messages.length === 0 && !isLoadingSession;
  const currentSession = sessions.find((session) => session.id === currentSessionId) ?? null;

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
            ? messages.map((message, index) => {
                return (
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
                );
              })
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
          <img
            alt="Alchemist"
            className="sidebar__wordmark"
            src={ASSETS.brandWordmark}
          />
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

export default App;

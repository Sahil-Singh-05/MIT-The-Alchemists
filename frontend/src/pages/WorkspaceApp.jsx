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
  { id: "sessions", label: "Sessions", icon: ASSETS.profile },
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

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(buildUrl(path), {
    ...options,
    credentials: "include",
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

    const error = new Error(detail);
    error.status = response.status;
    throw error;
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
    question: message.question,
    sources: message.sources,
    hasConflict: message.has_conflict ?? message.hasConflict,
    conflictNote: message.conflict_note ?? message.conflictNote,
    hasAnswer: message.has_answer ?? message.hasAnswer,
    noAnswerReason: message.no_answer_reason ?? message.noAnswerReason,
    isError: message.is_error ?? message.isError,
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

  const date = parseApiDate(timestamp);

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

  const date = parseApiDate(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatRelativeTicketTime(timestamp) {
  if (!timestamp) {
    return "Pending";
  }

  const date = parseApiDate(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes} min ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.max(1, Math.round(diffMs / day));

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const weeks = Math.max(1, Math.round(days / 7));

  if (weeks < 5) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  const months = Math.max(1, Math.round(days / 30));
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function truncateLabel(value, maxLength = 20) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function truncateText(value, maxLength = 260) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

function humanizeError(error) {
  return error instanceof Error ? error.message : "The backend is not responding yet.";
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

function buildTicketQueries(messages) {
  return messages
    .filter((message) => message.role === "assistant" && message.question && !message.isError)
    .map((message) => ({
      question: message.question,
      answer: message.content,
      sources: Array.isArray(message.sources) ? message.sources : [],
    }))
    .filter((query) => query.question.trim() && query.answer.trim());
}

function parseApiDate(timestamp) {
  if (!timestamp) {
    return new Date("");
  }

  if (
    typeof timestamp === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp) &&
    !/[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp)
  ) {
    return new Date(`${timestamp}Z`);
  }

  return new Date(timestamp);
}

function formatUploadDate(timestamp) {
  if (!timestamp) {
    return "Pending";
  }

  const date = parseApiDate(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildTicketSummary(ticket) {
  const queries = Array.isArray(ticket?.queries) ? ticket.queries : [];
  const sourceNames = Array.isArray(ticket?.sources_cited)
    ? [...new Set(ticket.sources_cited.filter(Boolean))]
    : [];
  const latestQuestion =
    [...queries].reverse().find((query) => query?.question?.trim())?.question?.trim() ||
    ticket?.subject ||
    "the employee query";
  const queryCount = queries.filter((query) => query?.question?.trim()).length || 1;

  const summary = ticket?.chat_summary?.trim();
  const looksLikeCopiedAnswer = queries.some((query) => {
    const answer = query?.answer?.trim();
    if (!answer || !summary) {
      return false;
    }

    return summary === answer || summary === truncateText(answer, 260);
  });

  if (summary && !looksLikeCopiedAnswer) {
    return summary;
  }

  const sourceText = sourceNames.length
    ? `Sources cited: ${sourceNames.slice(0, 3).join(", ")}${sourceNames.length > 3 ? ", and others." : "."}`
    : "Sources cited from the indexed knowledge base.";

  if (queryCount === 1) {
    return `One employee support query was raised about '${latestQuestion}'. ${sourceText}`;
  }

  return `This ticket combines ${queryCount} related employee queries. The latest topic was '${latestQuestion}'. ${sourceText}`;
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

function WorkspaceApp({ currentUser, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState("chat");
  const [sessions, setSessions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [authSessions, setAuthSessions] = useState([]);
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
  const [selectedAdminTicket, setSelectedAdminTicket] = useState(null);
  const [selectedAdminDoc, setSelectedAdminDoc] = useState(null);
  const [isAdminUploading, setIsAdminUploading] = useState(false);
  const [adminUploadProgress, setAdminUploadProgress] = useState(0);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const composerInputRef = useRef(null);
  const endRef = useRef(null);
  const adminObjectUrlsRef = useRef(new Set());
  const profileMenuRef = useRef(null);
  const isAdminUser = currentUser?.role === "admin";
  const employeeProfile = useMemo(
    () => ({
      name: currentUser?.employee_name ?? "Employee",
      employeeId: currentUser?.employee_id ?? "N/A",
      clientName: currentUser?.employee_name ?? "Internal Support",
    }),
    [currentUser],
  );

  const deferredQuery = useDeferredValue(query);
  const visibleSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );
  const recentSessions = sessions.slice(0, 2);
  const filteredAdminDocuments = useMemo(() => {
    return adminDocuments
      .filter((doc) => (adminFilter === "all" ? true : doc.type === adminFilter))
      .filter((doc) => doc.name.toLowerCase().includes(adminSearch.trim().toLowerCase()));
  }, [adminDocuments, adminFilter, adminSearch]);
  const ticketQueries = useMemo(() => buildTicketQueries(messages), [messages]);
  const currentConversationTicket = useMemo(() => {
    if (!currentSessionId || !ticketQueries.length) {
      return null;
    }

    const latestQuery = ticketQueries[ticketQueries.length - 1];
    const combinedSources = ticketQueries.flatMap((queryItem) => queryItem.sources);

    return {
      session_id: currentSessionId,
      question: latestQuery.question,
      answer: latestQuery.answer,
      sources: combinedSources,
      client_name: employeeProfile.clientName,
      priority: "Medium",
      created_by: employeeProfile.name,
      employee_id: employeeProfile.employeeId,
      chat_summary: "",
      queries: ticketQueries,
    };
  }, [currentSessionId, employeeProfile, ticketQueries]);
  const hasCurrentSessionTicket = useMemo(() => {
    if (!currentSessionId) {
      return false;
    }

    return tickets.some((ticket) => ticket.session_id === currentSessionId);
  }, [currentSessionId, tickets]);
  const canCreateTicket =
    Boolean(currentConversationTicket) &&
    !hasCurrentSessionTicket &&
    !isCreatingTicket &&
    !isSubmitting &&
    !isLoadingSession;
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

  function normalizeAdminDocument(document) {
    return {
      id: document.id,
      name: document.filename,
      type: document.file_type,
      size: formatFileSize(document.file_size),
      uploadedBy: document.uploaded_by_name,
      uploadDate: formatUploadDate(document.uploaded_at),
      pages:
        document.file_type === "pdf"
          ? `${document.total_chunks} chunks`
          : document.file_type === "excel"
            ? "Workbook"
            : "Email",
      category: document.category,
      description: document.description,
      totalQueries: document.total_queries ?? 0,
      viewerPath: `/admin/documents/${document.id}/viewer`,
    };
  }

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const requests = [
          apiRequest("/chat/sessions").catch(() => []),
          apiRequest("/crm/tickets").catch(() => []),
          apiRequest("/auth/sessions").then((response) => response.sessions).catch(() => []),
        ];

        if (currentUser?.role === "admin") {
          requests.push(apiRequest("/admin/documents").catch(() => []));
        }

        const [sessionData, ticketData, authSessionData, documentData = []] = await Promise.all(requests);

        if (ignore) {
          return;
        }

        startTransition(() => {
          setSessions(sessionData);
          setTickets(ticketData);
          setAuthSessions(authSessionData);
          if (currentUser?.role === "admin") {
            setAdminDocuments((previousDocs) => {
              previousDocs.forEach((doc) => revokeAdminObjectUrl(doc.viewerUrl));
              return documentData.map(normalizeAdminDocument);
            });
          }
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
  }, [currentUser?.role]);

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
    return () => {
      adminObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      adminObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [currentUser?.id, sidebarOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setError("");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [error]);

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

  async function refreshTickets() {
    try {
      const ticketData = await apiRequest("/crm/tickets");
      startTransition(() => {
        setTickets(ticketData);
      });
    } catch (refreshError) {
      setError(humanizeError(refreshError));
    }
  }

  async function refreshAuthSessions() {
    try {
      const response = await apiRequest("/auth/sessions");
      startTransition(() => {
        setAuthSessions(response.sessions);
      });
    } catch (refreshError) {
      setError(humanizeError(refreshError));
    }
  }

  async function refreshAdminDocuments() {
    if (currentUser?.role !== "admin") {
      return;
    }

    try {
      const documentData = await apiRequest("/admin/documents");
      startTransition(() => {
        setAdminDocuments((previousDocs) => {
          previousDocs.forEach((doc) => revokeAdminObjectUrl(doc.viewerUrl));
          return documentData.map(normalizeAdminDocument);
        });
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

  async function createTicketForCurrentConversation(mode = "manual") {
    if (!currentConversationTicket || hasCurrentSessionTicket || isCreatingTicket) {
      return false;
    }

    setIsCreatingTicket(true);

    try {
      const createdTicket = await apiRequest("/crm/ticket", {
        method: "POST",
        body: JSON.stringify(currentConversationTicket),
      });

      startTransition(() => {
        setTickets((previousTickets) => [
          createdTicket,
          ...previousTickets.filter((ticket) => ticket.session_id !== createdTicket.session_id),
        ]);
      });
      await refreshTickets();

      setError(
        mode === "auto"
          ? "Ticket created automatically and sent to admin history."
          : "Ticket created and sent to admin history.",
      );

      return true;
    } catch (ticketError) {
      setError(humanizeError(ticketError));
      return false;
    } finally {
      setIsCreatingTicket(false);
    }
  }

  async function handleNewChat() {
    if (currentConversationTicket && !hasCurrentSessionTicket) {
      await createTicketForCurrentConversation("auto");
    }

    setActiveView("chat");
    setCurrentSessionId(null);
    setMessages([]);
    setDraft("");
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

  async function handleRevokeAuthSession(sessionId, isCurrent) {
    try {
      await apiRequest(`/auth/sessions/${sessionId}`, { method: "DELETE" });

      if (isCurrent) {
        await onLogout();
        return;
      }

      await refreshAuthSessions();
      setError("Session revoked.");
    } catch (sessionError) {
      setError(humanizeError(sessionError));
    }
  }

  async function handleLogoutEverywhere() {
    try {
      await apiRequest("/auth/logout-all", { method: "POST" });
    } finally {
      await onLogout();
    }
  }

  function handleProfileMenuToggle() {
    setIsProfileMenuOpen((previous) => !previous);
  }

  function closeProfileMenu() {
    setIsProfileMenuOpen(false);
  }

  async function handleAccountLogout() {
    closeProfileMenu();
    await onLogout();
  }

  function handleAdminViewChange(nextView) {
    setAdminView(nextView);
    setSelectedAdminTicket(null);
    setSelectedAdminDoc(null);
    setError("");
  }

  async function handleAdminFilesAdded(fileList) {
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
    const uploadedDocs = [];
    const failedUploads = [];

    try {
      for (const [index, file] of acceptedFiles.entries()) {
        const formData = new FormData();
        const type = resolveAdminDocumentType(file.name);

        formData.append("file", file);

        try {
          const response = await apiRequest("/admin/upload", {
            method: "POST",
            body: formData,
          });

          uploadedDocs.push(
            response.document
              ? normalizeAdminDocument(response.document)
              : {
                  id: `admin-upload-${Date.now()}-${index}`,
                  name: response.filename ?? file.name,
                  type,
                  size: formatFileSize(file.size),
                  uploadedBy: employeeProfile.name,
                  uploadDate: formatUploadDate(new Date().toISOString()),
                  pages: type === "pdf" ? "Indexed" : type === "excel" ? "Workbook" : "Email",
                  category:
                    type === "pdf" ? "Policy / PDF" : type === "excel" ? "Data / Excel" : "Inbox / Email",
                  description:
                    response.message ??
                    "Document uploaded and ingested into the knowledge base successfully.",
                  totalQueries: 0,
                  previewUrl: registerAdminObjectUrl(URL.createObjectURL(file)),
                },
          );
        } catch (uploadError) {
          failedUploads.push(`${file.name}: ${humanizeError(uploadError)}`);
        } finally {
          setAdminUploadProgress(Math.round(((index + 1) / acceptedFiles.length) * 100));
        }
      }

      if (uploadedDocs.length) {
        startTransition(() => {
          setAdminDocuments((previousDocs) => [...uploadedDocs, ...previousDocs]);
        });
        await refreshAdminDocuments();
      }

      if (failedUploads.length) {
        setError(failedUploads.join(" | "));
      } else if (uploadedDocs.length) {
        setError(`${uploadedDocs.length} file(s) uploaded and ingested into the knowledge base.`);
      }
    } finally {
      window.setTimeout(() => {
        setIsAdminUploading(false);
        setAdminUploadProgress(0);
      }, 220);
    }
  }

  function handleAdminFileInputChange(event) {
    handleAdminFilesAdded(event.target.files);
    event.target.value = "";
  }

  function handleAdminDocumentOpen(doc) {
    setSelectedAdminDoc(doc);
  }

  function handleAdminModalClose() {
    setSelectedAdminDoc(null);
  }

  function handleAdminTicketSelect(ticket) {
    setSelectedAdminTicket(ticket);
  }

  function handleAdminTicketBack() {
    setSelectedAdminTicket(null);
  }

  function handleAdminOpenViewer(doc) {
    if (!doc?.viewerPath) {
      setError("Viewer unavailable for this document.");
      return;
    }

    const requestUrl = buildUrl(doc.viewerPath);
    fetch(requestUrl, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          let detail = "Unable to open this document.";
          try {
            const payload = await response.json();
            detail = payload.detail ?? detail;
          } catch {
            detail = response.statusText || detail;
          }
          throw new Error(detail);
        }

        const blob = await response.blob();
        const viewerUrl = registerAdminObjectUrl(URL.createObjectURL(blob));
        window.open(viewerUrl, "_blank", "noopener,noreferrer");
      })
      .catch((viewerError) => {
        setError(humanizeError(viewerError));
      });
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

        <div className="chat-view__composer-row">
          <div className="chat-view__composer">{renderComposer(true)}</div>

          {canCreateTicket ? (
            <button
              className="create-ticket-button"
              type="button"
              onClick={() => createTicketForCurrentConversation("manual")}
              disabled={isCreatingTicket}
            >
              {isCreatingTicket ? "Creating..." : "Create Ticket"}
            </button>
          ) : null}
        </div>
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

  function renderSessionControlView() {
    return (
      <section className="panel-view">
        <header className="panel-view__header">
          <p>Sessions</p>
          <span>Manage this account&apos;s active login sessions.</span>
        </header>

        <div className="session-control">
          <div className="session-control__header">
            <strong>Active Sessions</strong>
            <button className="session-control__action" type="button" onClick={handleLogoutEverywhere}>
              Logout All
            </button>
          </div>

          <div className="session-control__list">
            {authSessions.length ? (
              authSessions.map((session) => (
                <article className="session-control__card" key={session.id}>
                  <div className="session-control__meta">
                    <strong>{session.is_current ? "Current device" : "Signed-in device"}</strong>
                    <span>{formatUploadDate(session.created_at)}</span>
                    <small>Last seen {formatRelativeTicketTime(session.last_seen_at)}</small>
                  </div>

                  <button
                    className="session-control__action"
                    type="button"
                    onClick={() => handleRevokeAuthSession(session.id, session.is_current)}
                  >
                    {session.is_current ? "Logout" : "Revoke"}
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-card">
                <p>No active sessions found.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderAdminUploadsView() {
    return (
      <section className="admin-dashboard">
        <header className="admin-dashboard__topbar">
          <h1>Upload Documents</h1>
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
                <article
                  className={`admin-doc-row admin-doc-row--${doc.type}`}
                  key={doc.id}
                  onClick={() => handleAdminDocumentOpen(doc)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleAdminDocumentOpen(doc);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="admin-doc-row__meta">
                    <span className={`admin-doc-row__icon admin-doc-row__icon--${doc.type}`}>
                      <i className={`fa ${getAdminDocumentIcon(doc.type)}`} aria-hidden="true" />
                    </span>
                    <span className="admin-doc-row__name">{doc.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAdminDocumentOpen(doc);
                    }}
                  >
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

        {selectedAdminDoc ? (
          <div className="admin-doc-modal-overlay" onClick={handleAdminModalClose}>
            <section
              className="admin-doc-modal"
              onClick={(event) => event.stopPropagation()}
              aria-modal="true"
              role="dialog"
            >
              <div className="admin-doc-modal__header">
                <div>
                  <h2>{selectedAdminDoc.name}</h2>
                  <div className="admin-doc-modal__badges">
                    <span className={`admin-doc-badge admin-doc-badge--${selectedAdminDoc.type}`}>
                      {selectedAdminDoc.type === "excel"
                        ? "XLSX"
                        : selectedAdminDoc.type.toUpperCase()}
                    </span>
                    <span className="admin-doc-badge admin-doc-badge--indexed">Indexed</span>
                    <span className="admin-doc-badge admin-doc-badge--category">
                      {selectedAdminDoc.category}
                    </span>
                  </div>
                </div>

                <button
                  className="admin-doc-modal__close"
                  type="button"
                  onClick={handleAdminModalClose}
                  aria-label="Close document details"
                >
                  <i className="fa fa-times" aria-hidden="true" />
                </button>
              </div>

              <div className="admin-doc-modal__grid">
                <div className="admin-doc-modal__card">
                  <span>File Size</span>
                  <strong>{selectedAdminDoc.size}</strong>
                </div>
                <div className="admin-doc-modal__card">
                  <span>Format</span>
                  <strong>
                    {selectedAdminDoc.type === "excel"
                      ? "Excel"
                      : selectedAdminDoc.type === "email"
                        ? "Email"
                        : "PDF"}
                  </strong>
                </div>
                <div className="admin-doc-modal__card">
                  <span>Uploaded by</span>
                  <strong>{selectedAdminDoc.uploadedBy}</strong>
                </div>
                <div className="admin-doc-modal__card">
                  <span>Upload date</span>
                  <strong>{selectedAdminDoc.uploadDate}</strong>
                </div>
                <div className="admin-doc-modal__card admin-doc-modal__card--wide">
                  <span>Total queries answered</span>
                  <strong>{selectedAdminDoc.totalQueries ?? 0}</strong>
                </div>
              </div>

              <div className="admin-doc-modal__summary">
                {selectedAdminDoc.description || "No short description available yet."}
              </div>

              <div className="admin-doc-modal__actions">
                <button
                  className="admin-doc-modal__primary"
                  type="button"
                  onClick={() => handleAdminOpenViewer(selectedAdminDoc)}
                >
                  Open in Viewer
                </button>
                <button
                  className="admin-doc-modal__secondary"
                  type="button"
                  onClick={handleAdminModalClose}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
  }

  function renderAdminTicketsView() {
    if (selectedAdminTicket) {
      return (
        <section className="admin-dashboard">
          <div className="tickets-page">
            <div className="tickets-shell">
              <button
                type="button"
                className="tickets-back-button"
                onClick={handleAdminTicketBack}
              >
                <span className="tickets-back-arrow" aria-hidden="true">
                  ←
                </span>
                <span>Back to Tickets</span>
              </button>

              <div className="tickets-detail-card">
                <div className="tickets-detail-scroll">
                  <div className="tickets-detail-row">
                    <div className="tickets-detail-label">Ticket ID</div>
                    <div className="tickets-detail-value tickets-detail-id">
                      {selectedAdminTicket.ticket_id}
                    </div>
                  </div>

                  <div className="tickets-detail-row">
                    <div className="tickets-detail-label">Subject</div>
                    <div className="tickets-detail-value">{selectedAdminTicket.subject}</div>
                  </div>

                  <div className="tickets-detail-row">
                    <div className="tickets-detail-label">Created By</div>
                    <div className="tickets-detail-value">
                      {selectedAdminTicket.created_by || employeeProfile.name}
                    </div>
                  </div>

                  <div className="tickets-detail-row">
                    <div className="tickets-detail-label">Employee ID</div>
                    <div className="tickets-detail-value">
                      {selectedAdminTicket.employee_id || employeeProfile.employeeId}
                    </div>
                  </div>

                  <div className="tickets-detail-row">
                    <div className="tickets-detail-label">Updated</div>
                    <div className="tickets-detail-value">
                      {formatRelativeTicketTime(selectedAdminTicket.created_at)}
                    </div>
                  </div>

                  <div className="tickets-detail-row tickets-detail-block">
                    <div className="tickets-detail-label">Chat Summary</div>
                    <div className="tickets-detail-copy">
                      {buildTicketSummary(selectedAdminTicket)}
                    </div>
                  </div>

                  <div className="tickets-detail-section">
                    <div className="tickets-detail-section-title">Queries</div>

                    <div className="tickets-query-list">
                      {selectedAdminTicket.queries?.length ? (
                        selectedAdminTicket.queries.map((queryItem, index) => (
                          <div
                            key={`${selectedAdminTicket.ticket_id}-query-${index}`}
                            className="tickets-query-item"
                          >
                            <div className="tickets-query-question">
                              Q. {queryItem.question || `Query ${index + 1}`}
                            </div>
                            <div className="tickets-query-answer-wrap">
                              <span className="tickets-query-arrow">&gt;</span>
                              <div className="tickets-query-answer">
                                {queryItem.answer || "No AI answer available."}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="tickets-query-item">
                          <div className="tickets-query-question">Q. {selectedAdminTicket.subject}</div>
                          <div className="tickets-query-answer-wrap">
                            <span className="tickets-query-arrow">&gt;</span>
                            <div className="tickets-query-answer">
                              {selectedAdminTicket.description || "No query history available."}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="admin-dashboard">
        <div className="tickets-page">
          <div className="tickets-shell">
            <h1 className="tickets-title">Tickets</h1>

            <div className="tickets-table">
              <div className="tickets-card tickets-card-header">
                <div className="tickets-grid tickets-grid-header">
                  <div className="tickets-heading">Ticket ID</div>
                  <div className="tickets-heading">Subject</div>
                  <div className="tickets-heading tickets-heading-right">Updated</div>
                </div>
              </div>

              <div className="tickets-card tickets-card-body">
                {isBooting ? (
                  <div className="admin-empty-state">
                    <p>Loading tickets...</p>
                  </div>
                ) : tickets.length ? (
                  tickets.map((ticket) => (
                    <div
                      className="tickets-row"
                      key={ticket.ticket_id}
                      onClick={() => handleAdminTicketSelect(ticket)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleAdminTicketSelect(ticket);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="tickets-mobile-label">Ticket ID</div>
                      <div className="tickets-row-id">{ticket.ticket_id}</div>

                      <div className="tickets-mobile-label">Subject</div>
                      <div className="tickets-row-subject">{ticket.subject}</div>

                      <div className="tickets-mobile-label">Updated</div>
                      <div className="tickets-row-updated">
                        {formatRelativeTicketTime(ticket.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="admin-empty-state">
                    <p>No tickets yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderAccountSection(shellClassName) {
    return (
      <div className={`${shellClassName}__account account-panel`} ref={profileMenuRef}>
        {isProfileMenuOpen ? (
          <div className="account-panel__menu" role="menu">
            <div className="account-panel__identity">
              <strong>{employeeProfile.name}</strong>
              <span>{currentUser?.email || "No email available"}</span>
              <small>{isAdminUser ? "Admin account" : `Employee ID: ${employeeProfile.employeeId}`}</small>
            </div>

            <button
              className="account-panel__action"
              type="button"
              onClick={handleAccountLogout}
              role="menuitem"
            >
              Logout
            </button>
          </div>
        ) : null}

        <button
          className={`${shellClassName}__profile account-panel__toggle`}
          type="button"
          onClick={handleProfileMenuToggle}
          aria-expanded={isProfileMenuOpen}
          aria-haspopup="menu"
        >
          <img alt="" src={ASSETS.profile} />
          <span>Profile</span>
        </button>
      </div>
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
                  onClick={() => handleAdminViewChange(item.id)}
                >
                  <img alt="" src={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {renderAccountSection("admin-sidebar")}
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
              {recentSessions.length ? (
                recentSessions.map((session) => (
                  <button
                    className="sidebar__recent"
                    key={session.id}
                    type="button"
                    onClick={() => openSession(session.id)}
                  >
                    {truncateLabel(session.title, 22)}
                  </button>
                ))
              ) : (
                <span className="sidebar__recent sidebar__recent--empty">No recent chats</span>
              )}
            </div>
          </div>

          {renderAccountSection("sidebar")}
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
          {activeView === "sessions" ? renderSessionControlView() : null}
        </main>
      </div>
    );
  }

  return isAdminUser ? renderAdminShell() : renderEmployeeShell();
}

export default WorkspaceApp;

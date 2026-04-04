import { useEffect, useState } from "react";

import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import SplashScreen from "./pages/SplashScreen.jsx";
import WorkspaceApp from "./pages/WorkspaceApp.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const KNOWN_PATHS = new Set(["/", "/signin", "/signup", "/dashboard"]);

function getCurrentPath() {
  const path = window.location.pathname || "/";
  return KNOWN_PATHS.has(path) ? path : "/";
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function formatApiErrorDetail(detail) {
  if (!detail) {
    return "Request failed.";
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item?.msg) {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
          const label = typeof field === "string" ? field.replace(/_/g, " ") : "";
          return label ? `${label}: ${item.msg}` : item.msg;
        }

        return null;
      })
      .filter(Boolean);

    return messages.length ? messages.join(" ") : "Request failed.";
  }

  if (typeof detail === "object") {
    return detail.message ?? JSON.stringify(detail);
  }

  return "Request failed.";
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
      detail = formatApiErrorDetail(payload.detail ?? detail);
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

export default function App() {
  const [path, setPath] = useState(getCurrentPath);
  const [currentUser, setCurrentUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const navigate = (nextPath, options = {}) => {
    const normalizedPath = KNOWN_PATHS.has(nextPath) ? nextPath : "/";
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({}, "", normalizedPath);
    setPath(normalizedPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPath(getCurrentPath());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const response = await apiRequest("/auth/me");
        if (!ignore) {
          setCurrentUser(response.user);
        }
      } catch (error) {
        if (!ignore) {
          setCurrentUser(null);
        }
      } finally {
        if (!ignore) {
          setAuthResolved(true);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    if (!currentUser && path === "/dashboard") {
      navigate("/signin", { replace: true });
      return;
    }

    if (currentUser && (path === "/signin" || path === "/signup")) {
      navigate("/dashboard", { replace: true });
    }
  }, [authResolved, currentUser, path]);

  const handleAuthSuccess = (response) => {
    setCurrentUser(response.user);
    setAuthError("");
    navigate("/dashboard", { replace: true });
  };

  const handleSignIn = async (payload) => {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignUp = async (payload) => {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await apiRequest("/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // We still clear local user state even if the session has already expired.
    }

    setCurrentUser(null);
    setAuthError("");
    navigate("/signin", { replace: true });
  };

  if (!authResolved) {
    return <SplashScreen ready={false} destination={null} onNavigate={navigate} />;
  }

  if (path === "/") {
    return (
      <SplashScreen
        ready
        destination={currentUser ? "/dashboard" : "/signin"}
        onNavigate={navigate}
      />
    );
  }

  if (path === "/signup") {
    return (
      <SignUp
        error={authError}
        loading={isAuthSubmitting}
        onNavigateSignIn={() => {
          setAuthError("");
          navigate("/signin");
        }}
        onSubmit={handleSignUp}
      />
    );
  }

  if (path === "/signin") {
    return (
      <SignIn
        error={authError}
        loading={isAuthSubmitting}
        onNavigateSignUp={() => {
          setAuthError("");
          navigate("/signup");
        }}
        onSubmit={handleSignIn}
      />
    );
  }

  if (!currentUser) {
    return <SplashScreen ready={false} destination={null} onNavigate={navigate} />;
  }

  return <WorkspaceApp currentUser={currentUser} onLogout={handleLogout} />;
}

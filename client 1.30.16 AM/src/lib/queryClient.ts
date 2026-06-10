import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ─── Token Management ─────────────────────────────────────────────────────
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── CSRF Token Management ────────────────────────────────────────────────
let csrfToken: string | null = null;

/** Fetch CSRF token from server (called once on app init) */
export async function initCsrfToken(): Promise<void> {
  try {
    const res = await fetch("/api/auth/csrf-token", {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
    }
  } catch {
    // Non-critical — CSRF enforcement is only active in production
  }
}

// ─── Refresh Token Debouncing ─────────────────────────────────────────────
let refreshPromise: Promise<boolean> | null = null;

/** Attempt to refresh the access token, debounced so only one request fires */
async function tryRefreshToken(): Promise<boolean> {
  // If a refresh is already in-flight, piggyback on it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        setAccessToken(null);
        return false;
      }

      const data = await res.json();
      if (data.success && data.token) {
        setAccessToken(data.token);
        return true;
      }
      return false;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      // Clear the debounce after a short delay to prevent tight loops
      setTimeout(() => {
        refreshPromise = null;
      }, 1000);
    }
  })();

  return refreshPromise;
}

// ─── API Utilities ────────────────────────────────────────────────────────

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Build headers with JWT Authorization and CSRF token */
function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: buildHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always send cookies (session + refresh token)
  });

  // If 401 and we have a token, try to refresh
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with new token
      const retryRes = await fetch(url, {
        method,
        headers: buildHeaders(!!data),
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      await throwIfResNotOk(retryRes);
      return retryRes;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

// ─── React Query Configuration ───────────────────────────────────────────

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    let res = await fetch(url, {
      credentials: "include",
      headers,
    });

    // Try token refresh on 401
    if (res.status === 401 && accessToken) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const retryHeaders: Record<string, string> = {};
        if (accessToken) {
          retryHeaders["Authorization"] = `Bearer ${accessToken}`;
        }
        if (csrfToken) {
          retryHeaders["X-CSRF-Token"] = csrfToken;
        }
        res = await fetch(url, {
          credentials: "include",
          headers: retryHeaders,
        });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

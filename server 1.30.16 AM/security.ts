import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { Express, Request, Response, NextFunction } from "express";
import { randomBytes, createHmac } from "crypto";

// ─── CSRF Token Management ────────────────────────────────────────────────────

const CSRF_SECRET =
  process.env.CSRF_SECRET || randomBytes(32).toString("hex");

/** Generate a CSRF token using double-submit cookie pattern */
function generateCsrfToken(): string {
  const token = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");
  return `${token}.${signature}`;
}

/** Validate a CSRF token */
function validateCsrfToken(fullToken: string): boolean {
  const parts = fullToken.split(".");
  if (parts.length !== 2) return false;
  const [token, signature] = parts;
  const expected = createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");
  return signature === expected;
}

// ─── Security Setup ───────────────────────────────────────────────────────────

export function setupSecurity(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  // ── Helmet: Security Headers ──────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? undefined // Use Helmet's sensible defaults in production
        : false, // Disable CSP in dev (Vite injects inline scripts)
      crossOriginEmbedderPolicy: false, // May interfere with image loading
    })
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: isProduction
        ? allowedOrigins
        : true, // Allow all origins in development
      credentials: true, // Required for cookies (session, refresh token)
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
      ],
      maxAge: 86400, // 24 hours
    })
  );

  // ── Global Rate Limiter ───────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "200", 10),
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
    skip: (req) => {
      // Don't rate-limit health checks
      return req.path === "/api/auth/health";
    },
  });
  app.use("/api", globalLimiter);

  // ── Auth Rate Limiter (stricter) ──────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "900000", 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many authentication attempts, please try again later.",
    },
    keyGenerator: (req) => {
      // Rate limit by IP + attempted username to prevent distributed attacks
      const ip =
        req.ip || req.headers["x-forwarded-for"] || "unknown";
      const username = req.body?.username || req.body?.email || "";
      return `${ip}:${username}`;
    },
  });

  // Apply strict rate limit to auth endpoints
  app.use("/api/login", authLimiter);
  app.use("/api/register", authLimiter);
  app.use("/api/auth/refresh", authLimiter);

  // ── CSRF Protection ───────────────────────────────────────────────────────

  // Endpoint to get a CSRF token
  app.get("/api/auth/csrf-token", (_req: Request, res: Response) => {
    const token = generateCsrfToken();
    // Set as cookie for automatic inclusion
    res.cookie("csrf_token", token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    res.json({ success: true, csrfToken: token });
  });

  // CSRF validation middleware for state-changing requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Skip auth endpoints (login/register don't have a token yet)
    const skipPaths = [
      "/api/login",
      "/api/register",
      "/api/auth/refresh",
      "/api/auth/csrf-token",
      "/api/auth/health",
    ];
    if (skipPaths.some((p) => req.path === p)) {
      return next();
    }

    // Skip in development mode for easier testing
    if (!isProduction) {
      return next();
    }

    // Validate CSRF token from header or cookie
    const headerToken = req.headers["x-csrf-token"] as string;
    const cookieToken = (req as any).cookies?.csrf_token;
    const token = headerToken || cookieToken;

    if (!token || !validateCsrfToken(token)) {
      return res.status(403).json({
        success: false,
        message: "Invalid or missing CSRF token",
      });
    }

    next();
  });
}

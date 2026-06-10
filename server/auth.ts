import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// ─── JWT Configuration ──────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRES_IN = "15m"; // Short-lived access tokens
const JWT_REFRESH_EXPIRES_IN = "7d"; // Long-lived refresh tokens
const REFRESH_TOKEN_DAYS = 7;
const SESSION_SECRET = process.env.SESSION_SECRET;
const JWT_ISSUER = "canar-api";
const JWT_AUDIENCE = "canar-client";

// Fail hard in production if secrets are missing
if (process.env.NODE_ENV === "production") {
  if (!JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET must be set in production");
  }
  if (!SESSION_SECRET) {
    throw new Error("FATAL: SESSION_SECRET must be set in production");
  }
}

// Fallbacks only for development
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-jwt-secret-NOT-FOR-PRODUCTION";
const EFFECTIVE_SESSION_SECRET =
  SESSION_SECRET || "dev-session-secret-NOT-FOR-PRODUCTION";

// Environment-based auth strategy: "session" | "jwt" | "hybrid"
const AUTH_STRATEGY = process.env.AUTH_STRATEGY || "jwt";

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = parseInt(
  process.env.MAX_FAILED_LOGIN_ATTEMPTS || "10",
  10
);
const LOCKOUT_MINUTES = parseInt(
  process.env.ACCOUNT_LOCKOUT_MINUTES || "30",
  10
);

// Token cleanup interval (hours)
const TOKEN_CLEANUP_INTERVAL = parseInt(
  process.env.TOKEN_CLEANUP_INTERVAL_HOURS || "6",
  10
);

// ─── Input Validation Schemas ───────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const registerSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  username: z.string().max(100).optional(),
  password: passwordSchema,
  role: z.enum(["candidate", "recruiter"]).default("candidate"),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username/email is required").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

// Common weak passwords blocklist
const BLOCKED_PASSWORDS = new Set([
  "password",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "password1",
  "iloveyou",
  "admin123",
  "welcome1",
  "letmein12",
  "Password1",
  "Qwerty123",
]);

// ─── Audit Logger ───────────────────────────────────────────────────────────

type AuthEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "REGISTER_SUCCESS"
  | "REGISTER_FAILED"
  | "TOKEN_REFRESH"
  | "TOKEN_REFRESH_FAILED"
  | "TOKEN_REUSE_DETECTED"
  | "LOGOUT"
  | "PASSWORD_REJECTED";

function auditLog(
  event: AuthEvent,
  details: {
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  }
) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  // Structured JSON log — easy to pipe to log aggregation (ELK, CloudWatch, etc.)
  console.log(`[AUTH_AUDIT] ${JSON.stringify(entry)}`);
}

/** Extract client IP from request, accounting for proxies */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

// ─── Password Utilities ─────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// ─── Token Utilities ────────────────────────────────────────────────────────

/** Generate a short-lived JWT access token with tenant context */
function generateAccessToken(user: SelectUser): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.id, // Each user is their own tenant
    type: "access",
  };
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: randomBytes(16).toString("hex"), // Unique token ID
  } as jwt.SignOptions);
}

/** Generate a cryptographically random refresh token string */
function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}

/** Hash a refresh token for secure DB storage */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Verify and decode an access token */
function verifyAccessToken(token: string): any {
  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if ((payload as any).type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract bearer token from Authorization header or cookies */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return (req as any).cookies?.jwt || null;
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

/**
 * Primary authentication middleware.
 * Supports session, jwt, or hybrid strategy based on AUTH_STRATEGY env var.
 * Populates req.user on success; returns 401 on failure.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (AUTH_STRATEGY === "session") {
    // Session-only mode
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (AUTH_STRATEGY === "hybrid") {
    // Try session first, then JWT
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    // Fall through to JWT check
  }

  // JWT validation (used for "jwt" and "hybrid" strategies)
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      message: "No token provided",
    });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
    return;
  }

  // Attach minimal user info for downstream handlers
  (req as any).user = { id: payload.id, email: payload.email, role: payload.role };
  next();
}

/**
 * Tenant isolation middleware.
 * Ensures authenticated users can only access resources belonging to them.
 * Must be used AFTER requireAuth.
 */
export function requireTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  // Check all possible locations where a target userId might appear
  const requestedUserId =
    req.params.userId || req.body?.userId || req.query?.userId;

  // If a target userId is specified, enforce that it matches the authenticated user
  // Use String() coercion to handle potential type mismatches (param strings vs JWT values)
  if (requestedUserId && String(requestedUserId) !== String(userId)) {
    res.status(403).json({
      success: false,
      message: "Access denied: tenant isolation violation",
    });
    return;
  }

  next();
}

/**
 * Resource ownership middleware factory.
 * Verifies the resource being accessed belongs to the authenticated user.
 * @param getResourceUserId - async function that returns the userId owning the resource
 */
export function requireOwnership(
  getResourceUserId: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const resourceUserId = await getResourceUserId(req);
    if (!resourceUserId) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    if (String(resourceUserId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you do not own this resource",
      });
    }

    next();
  };
}

// ─── Token Cleanup ──────────────────────────────────────────────────────────

/** Periodically clean up expired refresh tokens */
function startTokenCleanup() {
  const intervalMs = TOKEN_CLEANUP_INTERVAL * 60 * 60 * 1000;

  const cleanup = async () => {
    try {
      const deleted = await storage.deleteExpiredRefreshTokens(30);
      if (deleted > 0) {
        console.log(`[TOKEN_CLEANUP] Removed ${deleted} expired refresh tokens`);
      }
    } catch (error) {
      console.error("[TOKEN_CLEANUP] Error:", error);
    }
  };

  // Run immediately on startup, then on interval
  cleanup();
  setInterval(cleanup, intervalMs);
}

// ─── Auth Setup ─────────────────────────────────────────────────────────────

export function setupAuth(app: Express) {
  // Session configuration (for session and hybrid modes)
  if (AUTH_STRATEGY !== "jwt") {
    const sessionSettings: session.SessionOptions = {
      secret: EFFECTIVE_SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      },
      name: "connect.sid",
    };

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());
  } else {
    // JWT-only mode still needs passport.initialize for local strategy
    app.use(passport.initialize());
  }

  // Local Strategy — always needed for login (validates username/password)
  passport.use(
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid credentials" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize/deserialize for session-based auth
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(null, false);
    }
  });

  // Start token cleanup scheduler
  startTokenCleanup();

  // ─── Registration ───────────────────────────────────────────────────────
  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map((e) => e.message);
        auditLog("REGISTER_FAILED", {
          email: req.body?.email,
          ip: getClientIp(req),
          reason: errors.join("; "),
        });
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }

      const { email, username, password, role } = parseResult.data;

      // Check blocked passwords
      if (BLOCKED_PASSWORDS.has(password) || BLOCKED_PASSWORDS.has(password.toLowerCase())) {
        auditLog("PASSWORD_REJECTED", {
          email,
          ip: getClientIp(req),
          reason: "Common password blocked",
        });
        return res.status(400).json({
          success: false,
          message: "This password is too common. Please choose a stronger password.",
        });
      }

      // Check for existing user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        auditLog("REGISTER_FAILED", {
          email,
          ip: getClientIp(req),
          reason: "Email already exists",
        });
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      const user = await storage.createUser({
        email,
        username: username || email,
        password: await hashPassword(password),
        role,
      });

      auditLog("REGISTER_SUCCESS", {
        userId: user.id,
        email: user.email,
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"],
      });

      if (AUTH_STRATEGY === "jwt") {
        // Issue tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();

        // Store refresh token hash in DB with device info
        const expiresAt = new Date(
          Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
        );
        await storage.createRefreshToken({
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt,
          userAgent: req.headers["user-agent"] || null,
          ipAddress: getClientIp(req),
        });

        // Set refresh token as httpOnly cookie
        res.cookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
          maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
          path: "/api/auth",
        });

        return res.status(201).json({
          success: true,
          user: sanitizeUser(user),
          token: accessToken,
          message: "Registration successful",
        });
      }

      // Session-based or hybrid: establish session
      req.login(user, (err: any) => {
        if (err) return next(err);

        // In hybrid mode, also issue JWT
        const response: any = {
          success: true,
          user: sanitizeUser(user),
          message: "Registration successful",
        };

        if (AUTH_STRATEGY === "hybrid") {
          response.token = generateAccessToken(user);
        }

        res.status(201).json(response);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // ─── Login ──────────────────────────────────────────────────────────────
  app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: parseResult.error.errors.map((e) => e.message),
        });
      }

      const { username } = parseResult.data;

      // Check account lockout before attempting authentication
      const targetUser = await storage.getUserByUsername(username);
      if (targetUser?.lockedUntil && new Date() < targetUser.lockedUntil) {
        const remainingMs = targetUser.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        auditLog("LOGIN_LOCKED", {
          userId: targetUser.id,
          email: targetUser.email,
          ip: getClientIp(req),
          userAgent: req.headers["user-agent"],
          reason: `Account locked for ${remainingMin} more minutes`,
        });
        return res.status(423).json({
          success: false,
          message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
        });
      }

      // Always use LocalStrategy to validate credentials, regardless of auth mode
      passport.authenticate(
        "local",
        async (err: any, user: SelectUser | false, info: any) => {
          if (err) return next(err);

          if (!user) {
            // Track failed login attempt
            if (targetUser) {
              const attempts = await storage.incrementFailedLoginAttempts(
                targetUser.id
              );
              if (attempts >= MAX_FAILED_ATTEMPTS) {
                await storage.lockUserAccount(targetUser.id, LOCKOUT_MINUTES);
                auditLog("LOGIN_LOCKED", {
                  userId: targetUser.id,
                  email: targetUser.email,
                  ip: getClientIp(req),
                  userAgent: req.headers["user-agent"],
                  reason: `Locked after ${attempts} failed attempts`,
                });
              }
            }

            auditLog("LOGIN_FAILED", {
              email: username,
              ip: getClientIp(req),
              userAgent: req.headers["user-agent"],
              reason: info?.message || "Invalid credentials",
            });

            return res.status(401).json({
              success: false,
              message: "Invalid credentials",
            });
          }

          // Successful login — reset failed attempts and update last login
          await storage.updateLastLogin(user.id);

          auditLog("LOGIN_SUCCESS", {
            userId: user.id,
            email: user.email,
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
          });

          if (AUTH_STRATEGY === "jwt") {
            // Issue access + refresh tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken();

            const expiresAt = new Date(
              Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
            );
            await storage.createRefreshToken({
              userId: user.id,
              tokenHash: hashToken(refreshToken),
              expiresAt,
              userAgent: req.headers["user-agent"] || null,
              ipAddress: getClientIp(req),
            });

            res.cookie("refresh_token", refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite:
                process.env.NODE_ENV === "production" ? "strict" : "lax",
              maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
              path: "/api/auth",
            });

            return res.status(200).json({
              success: true,
              user: sanitizeUser(user),
              token: accessToken,
              message: "Login successful",
            });
          }

          // Session-based or hybrid: establish session
          req.login(user, async (loginErr: any) => {
            if (loginErr) return next(loginErr);

            const response: any = {
              success: true,
              user: sanitizeUser(user),
              message: "Login successful",
            };

            if (AUTH_STRATEGY === "hybrid") {
              response.token = generateAccessToken(user);

              // Also issue refresh token for hybrid mode
              const refreshToken = generateRefreshToken();
              const expiresAt = new Date(
                Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
              );
              await storage.createRefreshToken({
                userId: user.id,
                tokenHash: hashToken(refreshToken),
                expiresAt,
                userAgent: req.headers["user-agent"] || null,
                ipAddress: getClientIp(req),
              });

              res.cookie("refresh_token", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite:
                  process.env.NODE_ENV === "production" ? "strict" : "lax",
                maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
                path: "/api/auth",
              });
            }

            res.status(200).json(response);
          });
        }
      )(req, res, next);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // ─── Token Refresh ──────────────────────────────────────────────────────
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshToken =
        (req as any).cookies?.refresh_token || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "No refresh token provided",
        });
      }

      const tokenHash = hashToken(refreshToken);
      const storedToken = await storage.getRefreshTokenByHash(tokenHash);

      if (!storedToken || storedToken.revoked || new Date() > storedToken.expiresAt) {
        // If token is revoked, revoke all tokens for this user (rotation breach)
        if (storedToken?.revoked) {
          await storage.revokeAllUserRefreshTokens(storedToken.userId);
          auditLog("TOKEN_REUSE_DETECTED", {
            userId: storedToken.userId,
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
            reason: "Revoked refresh token was reused — all sessions invalidated",
          });
        } else {
          auditLog("TOKEN_REFRESH_FAILED", {
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
            reason: storedToken ? "Token expired" : "Token not found",
          });
        }
        // Clear the invalid cookie
        res.clearCookie("refresh_token", { path: "/api/auth" });
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token",
        });
      }

      // Revoke the used refresh token (rotation)
      await storage.revokeRefreshToken(storedToken.id);

      // Get user
      const user = await storage.getUser(storedToken.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Issue new token pair
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken();

      const expiresAt = new Date(
        Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
      );
      await storage.createRefreshToken({
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt,
        userAgent: req.headers["user-agent"] || null,
        ipAddress: getClientIp(req),
      });

      res.cookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        path: "/api/auth",
      });

      auditLog("TOKEN_REFRESH", {
        userId: user.id,
        email: user.email,
        ip: getClientIp(req),
      });

      res.json({
        success: true,
        token: newAccessToken,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // ─── Logout ─────────────────────────────────────────────────────────────
  app.post("/api/logout", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      // Revoke refresh token if present
      const refreshToken = (req as any).cookies?.refresh_token;
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const storedToken = await storage.getRefreshTokenByHash(tokenHash);
        if (storedToken) {
          await storage.revokeRefreshToken(storedToken.id);
        }
      }

      // Clear refresh token cookie
      res.clearCookie("refresh_token", { path: "/api/auth" });

      auditLog("LOGOUT", {
        userId: userId ? String(userId) : undefined,
        ip: getClientIp(req),
      });

      if (AUTH_STRATEGY !== "jwt") {
        // Destroy session
        req.logout((err: any) => {
          if (err) return next(err);
          res.json({ success: true, message: "Logout successful" });
        });
      } else {
        res.json({ success: true, message: "Logout successful" });
      }
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // ─── User Info ──────────────────────────────────────────────────────────
  app.get("/api/user", requireAuth, async (req: Request, res: Response) => {
    try {
      // Fetch full user data from DB (middleware may only set id/email)
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user: sanitizeUser(user),
      });
    } catch (error) {
      console.error("User info error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // ─── Auth Health Check ──────────────────────────────────────────────────
  app.get("/api/auth/health", (_req: Request, res: Response) => {
    res.json({
      success: true,
      strategy: AUTH_STRATEGY,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip sensitive fields from user object before sending to client */
function sanitizeUser(user: SelectUser) {
  const { password, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

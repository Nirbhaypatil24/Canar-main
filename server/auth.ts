import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// JWT Configuration
const JWT_SECRET =
  process.env.JWT_SECRET || "your-jwt-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "your-super-secret-key-change-this-in-production";

// Environment-based auth strategy
const AUTH_STRATEGY = process.env.AUTH_STRATEGY || "session"; // "session" | "jwt" | "hybrid"

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function generateJWT(user: SelectUser): string {
  const payload = {
    id: user.id,
    email: user.email,
    tenantId: user.id, // For multi-tenant isolation
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware for JWT authentication
export function authenticateJWT(req: any, res: any, next: any) {
  if (AUTH_STRATEGY === "session") {
    return next();
  }

  const token =
    ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
    req.cookies?.jwt ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  // Set user in request for downstream middleware
  req.user = { id: payload.id, email: payload.email };
  next();
}

// Enhanced authentication middleware
export function requireAuth(req: any, res: any, next: any) {
  if (AUTH_STRATEGY === "jwt") {
    return authenticateJWT(req, res, next);
  }

  if (AUTH_STRATEGY === "hybrid") {
    // Try session first, then JWT
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    return authenticateJWT(req, res, next);
  }

  // Session-based auth
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
}

// Tenant isolation middleware
export function requireTenantAccess(req: any, res: any, next: any) {
  const userId = req.user?.id;
  const requestedUserId = req.params.userId || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Users can only access their own data (tenant isolation)
  if (requestedUserId && requestedUserId !== userId) {
    return res.status(403).json({
      success: false,
      message: "Access denied: tenant isolation",
    });
  }

  next();
}

export function setupAuth(app: Express) {
  // Session configuration (for development and hybrid mode)
  if (AUTH_STRATEGY !== "jwt") {
    const sessionSettings: session.SessionOptions = {
      secret: SESSION_SECRET,
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
  }

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // JWT Strategy
  if (AUTH_STRATEGY !== "session") {
    passport.use(
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          secretOrKey: JWT_SECRET,
        },
        async (payload: any, done: any) => {
          try {
            const user = await storage.getUser(payload.id);
            if (!user) {
              return done(null, false);
            }
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      console.log("Deserializing user ID:", id, typeof id);
      const user = await storage.getUser(id);
      console.log("Found user:", user ? user.email : "no");
      if (!user) {
        console.log("User not found during deserialization");
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(null, false);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, username, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      const user = await storage.createUser({
        email,
        username: username || email,
        password: await hashPassword(password),
      });

      if (AUTH_STRATEGY === "jwt") {
        const token = generateJWT(user);
        res.status(201).json({
          success: true,
          user,
          token,
          message: "Registration successful",
        });
      } else {
        req.login(user, (err: any) => {
          if (err) {
            console.error("Login after registration failed:", err);
            return next(err);
          }
          console.log("Registration successful, session established");
          res.status(201).json({
            success: true,
            user,
            message: "Registration successful",
          });
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req, res, next) => {
    if (AUTH_STRATEGY === "jwt") {
      passport.authenticate(
        "jwt",
        { session: false },
        async (err: any, user: any) => {
          if (err || !user) {
            return res.status(401).json({
              success: false,
              message: "Invalid credentials",
            });
          }
          const token = generateJWT(user);
          res.status(200).json({
            success: true,
            user,
            token,
            message: "Login successful",
          });
        }
      )(req, res, next);
    } else {
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({
            success: false,
            message: info?.message || "Invalid credentials",
          });
        }
        req.login(user, (err: any) => {
          if (err) {
            return next(err);
          }
          console.log(
            "Login successful, session established for user:",
            user.id
          );
          res.status(200).json({
            success: true,
            user,
            message: "Login successful",
          });
        });
      })(req, res, next);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    if (AUTH_STRATEGY === "jwt") {
      // JWT logout - client should remove token
      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } else {
      req.logout((err: any) => {
        if (err) return next(err);
        res.status(200).json({
          success: true,
          message: "Logout successful",
        });
      });
    }
  });

  // User info endpoint
  app.get("/api/user", requireAuth, (req, res) => {
    console.log("User check - authenticated:", req.isAuthenticated());
    console.log("User check - session:", (req.session as any)?.passport);
    console.log("User check - user:", req.user?.id);

    res.json({
      success: true,
      user: req.user,
    });
  });

  // Health check endpoint
  app.get("/api/auth/health", (req, res) => {
    res.json({
      success: true,
      strategy: AUTH_STRATEGY,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });
}

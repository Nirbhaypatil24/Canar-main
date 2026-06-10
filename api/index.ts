import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { setupDatabase, validateDatabase } from "../server/db-setup";
import { setupSecurity } from "../server/security";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Security middleware
setupSecurity(app);

// Database setup (runs once on cold start)
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    try {
      await setupDatabase();
      await validateDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }
}

// Lazy init the routes
let routesRegistered = false;
async function ensureRoutes() {
  if (!routesRegistered) {
    await ensureDb();
    await registerRoutes(app);

    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    routesRegistered = true;
  }
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  try {
    await ensureRoutes();
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Fatal Error:", error);
    res.status(500).json({
      success: false,
      message: "Server initialization failed",
      error: error.message || String(error)
    });
  }
}

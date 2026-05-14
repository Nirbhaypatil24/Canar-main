import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireTenantAccess } from "./auth";
import { SubscriptionService } from "./subscription-service";
import { S3Service } from "./s3-service";
import {
  insertProfileSchema,
  insertEducationSchema,
  insertProjectSchema,
  insertSkillSchema,
  insertExperienceSchema,
} from "@shared/schema";
import { z } from "zod";
import path from "path";
import { randomBytes } from "crypto";
import fs from "fs";
import multer from "multer";

function requireAuthLocal(req: any, res: any, next: any) {
  console.log("Auth check - isAuthenticated:", req.isAuthenticated());
  console.log("Auth check - user exists:", !!req.user);
  console.log("Auth check - session:", req.session?.passport);

  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  next();
}

async function requireCredits(req: any, res: any, next: any) {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const userId = req.user.id;
  const subscription = await storage.getUserSubscription(userId);

  if (!subscription || !subscription.active) {
    return res.status(403).json({ message: "Active subscription required" });
  }

  if (subscription.creditsRemaining < 5) {
    return res.status(403).json({
      message: "Insufficient credits. Please top-up or upgrade your plan.",
    });
  }

  req.subscription = subscription;
  next();
}

// Helper function to get user ID with fallback for development
function getUserId(req: any): string {
  // In development/bypass mode, use hardcoded ID if no authenticated user
  if (req.user?.id) {
    return req.user.id;
  }

  // For bypass mode, use UUID format for user ID
  return "00000000-0000-0000-0000-000000000001";
}

// Helper function to safely get error message
function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper function to generate share slug
function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

// Configure multer for file uploads (memory storage for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for S3 upload
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only PDF files for CV uploads
    if (file.fieldname === "cv" && file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed for CV upload"));
      return;
    }
    // Allow images for photo uploads
    if (file.fieldname === "photo" && !file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed for photo upload"));
      return;
    }
    cb(null, true);
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Serve test forms for debugging
  app.get("/test", (req, res) => {
    res.sendFile(path.join(process.cwd(), "test_form.html"));
  });

  app.get("/input-test", (req, res) => {
    res.sendFile(path.join(process.cwd(), "simple_input_test.html"));
  });

  app.get("/debug-input", (req, res) => {
    res.sendFile(path.join(process.cwd(), "debug_input_test.html"));
  });

  // Subscription routes
  app.get("/api/subscription/plans", requireAuth, (req, res) => {
    const plans = SubscriptionService.getPlans();
    res.json({
      success: true,
      plans,
    });
  });

  app.post(
    "/api/subscription/subscribe",
    requireAuth,
    requireTenantAccess,
    async (req, res) => {
      try {
        const { planType } = req.body;

        if (!planType) {
          return res.status(400).json({
            success: false,
            message: "Plan type is required",
          });
        }

        const userId = getUserId(req);

        // Use subscription service to create subscription
        const subscription = await SubscriptionService.createSubscription(
          userId,
          planType
        );

        res.json({
          success: true,
          subscription,
          message: `${subscription.planType} subscription created successfully`,
        });
      } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({
          success: false,
          message: getErrorMessage(error) || "Error creating subscription",
        });
      }
    }
  );

  app.post("/api/subscription/credits/topup", async (req, res) => {
    try {
      const { credits, amount } = req.body;

      if (!credits || !amount) {
        return res.status(400).json({
          success: false,
          message: "Credits and amount are required",
        });
      }

      const userId = getUserId(req);

      // Get or create subscription for bypass mode
      let subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        // Create a default subscription for bypass mode
        subscription = await storage.createSubscription({
          userId,
          planType: "Premium",
          creditsAllocated: credits,
          creditsRemaining: credits,
          active: true,
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        });
      } else {
        // Add credits to existing subscription
        await storage.addCreditsToSubscription(userId, credits);
      }

      // Create credit purchase record
      await storage.createCreditPurchase({
        userId,
        credits,
        amount,
      });

      res.json({
        success: true,
        message: "Credits added successfully",
        credits,
        newBalance: (subscription.creditsRemaining || 0) + credits,
      });
    } catch (error) {
      console.error("Error adding credits:", error);
      res.status(500).json({
        success: false,
        message: "Error adding credits",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Credits info
  app.get("/api/credits", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Get or create subscription for bypass mode
      let subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        // Create a default subscription for bypass mode
        subscription = await storage.createSubscription({
          userId,
          planType: "Premium",
          creditsAllocated: 1000,
          creditsRemaining: 1000,
          active: true,
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        });
      }

      const status = await SubscriptionService.getSubscriptionStatus(userId);

      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching credits",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Profile routes
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      const profile = await storage.getUserProfile(userId);

      if (!profile) {
        return res.json({
          success: true,
          profile: null,
          education: [],
          projects: [],
          skills: [],
          experiences: [],
        });
      }

      // Get all related data
      const [education, projects, skills, experiences] = await Promise.all([
        storage.getUserEducation(userId),
        storage.getUserProjects(userId),
        storage.getUserSkills(userId),
        storage.getUserExperiences(userId),
      ]);

      res.json({
        success: true,
        profile,
        education,
        projects,
        skills,
        experiences,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching profile",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Check credits before processing the update
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to edit profile",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      // Generate shareSlug if not provided
      const profileData = {
        ...req.body,
        userId,
        shareSlug: req.body.shareSlug || generateShareSlug(),
      };

      const validatedData = insertProfileSchema.parse(profileData);

      const profile = await storage.createOrUpdateProfile(validatedData);

      // Deduct credits (5 credits per edit)
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );

      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        profile,
        message: "Profile updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating profile",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Education routes
  app.get("/api/education", async (req, res) => {
    try {
      const userId = getUserId(req);
      const education = await storage.getUserEducation(userId);
      res.json({
        success: true,
        education,
      });
    } catch (error) {
      console.error("Error fetching education:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching education",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.post("/api/education", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add education",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const educationData = insertEducationSchema.parse({
        ...req.body,
        userId,
      });

      const education = await storage.createEducation(educationData);

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        education,
        message: "Education added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error creating education:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid education data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating education",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.put("/api/education/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update education",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const educationData = insertEducationSchema.partial().parse(req.body);

      const education = await storage.updateEducation(id, educationData);

      if (!education) {
        return res.status(404).json({
          success: false,
          message: "Education record not found",
        });
      }

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        education,
        message: "Education updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error updating education:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid education data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating education",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.delete("/api/education/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteEducation(id);
      res.json({
        success: true,
        message: "Education deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting education:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting education",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const userId = getUserId(req);
      const projects = await storage.getUserProjects(userId);
      res.json({
        success: true,
        projects,
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching projects",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add projects",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const projectData = insertProjectSchema.parse({ ...req.body, userId });

      const project = await storage.createProject(projectData);

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        project,
        message: "Project added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid project data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating project",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update projects",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const projectData = insertProjectSchema.partial().parse(req.body);

      const project = await storage.updateProject(id, projectData);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        project,
        message: "Project updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error updating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid project data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating project",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProject(id);
      res.json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting project",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Skill routes
  app.get("/api/skills", async (req, res) => {
    try {
      const userId = getUserId(req);
      const skills = await storage.getUserSkills(userId);
      res.json({
        success: true,
        skills,
      });
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching skills",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.post("/api/skills", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add skills",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const skillData = insertSkillSchema.parse({ ...req.body, userId });

      const skill = await storage.createSkill(skillData);

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        skill,
        message: "Skill added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error creating skill:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid skill data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating skill",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.put("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update skills",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const skillData = insertSkillSchema.partial().parse(req.body);

      const skill = await storage.updateSkill(id, skillData);

      if (!skill) {
        return res.status(404).json({
          success: false,
          message: "Skill not found",
        });
      }

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        skill,
        message: "Skill updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error updating skill:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid skill data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating skill",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.delete("/api/skills/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSkill(id);
      res.json({
        success: true,
        message: "Skill deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting skill",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Experience routes
  app.get("/api/experiences", async (req, res) => {
    try {
      const userId = getUserId(req);
      const experiences = await storage.getUserExperiences(userId);
      res.json({
        success: true,
        experiences,
      });
    } catch (error) {
      console.error("Error fetching experiences:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching experiences",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.post("/api/experiences", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add experience",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const experienceData = insertExperienceSchema.parse({
        ...req.body,
        userId,
      });

      const experience = await storage.createExperience(experienceData);

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        experience,
        message: "Experience added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error creating experience:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating experience",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.put("/api/experiences/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      // Check credits before processing
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update experience",
        });
      }

      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message:
            "Insufficient credits. Please top-up your credits to continue editing.",
        });
      }

      const experienceData = insertExperienceSchema.partial().parse(req.body);

      const experience = await storage.updateExperience(id, experienceData);

      if (!experience) {
        return res.status(404).json({
          success: false,
          message: "Experience not found",
        });
      }

      // Deduct credits
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again.",
        });
      }

      res.json({
        success: true,
        experience,
        message: "Experience updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining,
      });
    } catch (error) {
      console.error("Error updating experience:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience data",
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating experience",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  app.delete("/api/experiences/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteExperience(id);
      res.json({
        success: true,
        message: "Experience deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting experience:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting experience",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Public profile sharing
  app.get("/api/profile/share/:shareSlug", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const profile = await storage.getProfileByShareSlug(shareSlug);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Profile not found",
        });
      }

      // Get all related data for public profile
      const [education, projects, skills, experiences] = await Promise.all([
        storage.getUserEducation(profile.userId),
        storage.getUserProjects(profile.userId),
        storage.getUserSkills(profile.userId),
        storage.getUserExperiences(profile.userId),
      ]);

      res.json({
        success: true,
        profile,
        education,
        projects,
        skills,
        experiences,
      });
    } catch (error) {
      console.error("Error fetching shared profile:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching profile",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // File upload routes
  app.post(
    "/api/upload/cv",
    requireAuth,
    upload.single("cv"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded",
          });
        }

        const userId = getUserId(req);

        // Check if S3 is configured, fallback to local storage if not
        let fileUrl: string;
        if (S3Service.isConfigured()) {
          // Upload to S3
          const uploadResult = await S3Service.uploadFile(req.file, "cv");
          fileUrl = uploadResult.fileUrl;
        } else {
          // Fallback to local storage
          const uploadDir = path.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileName = `cv-${uniqueSuffix}${path.extname(
            req.file.originalname
          )}`;
          const filePath = path.join(uploadDir, fileName);

          fs.writeFileSync(filePath, req.file.buffer);
          fileUrl = `/uploads/${fileName}`;
        }

        // Update profile with CV URL
        const profile = await storage.getUserProfile(userId);
        if (profile) {
          await storage.createOrUpdateProfile({
            ...profile,
            cvUrl: fileUrl,
          });
        }

        res.json({
          success: true,
          fileUrl,
          message: "CV uploaded successfully",
        });
      } catch (error) {
        console.error("Error uploading CV:", error);
        res.status(500).json({
          success: false,
          message: "Error uploading CV",
          error:
            process.env.NODE_ENV === "development"
              ? getErrorMessage(error)
              : undefined,
        });
      }
    }
  );

  app.post(
    "/api/upload/photo",
    requireAuth,
    upload.single("photo"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded",
          });
        }

        const userId = getUserId(req);

        // Check if S3 is configured, fallback to local storage if not
        let fileUrl: string;
        if (S3Service.isConfigured()) {
          // Upload to S3
          const uploadResult = await S3Service.uploadFile(req.file, "photos");
          fileUrl = uploadResult.fileUrl;
        } else {
          // Fallback to local storage
          const uploadDir = path.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileName = `photo-${uniqueSuffix}${path.extname(
            req.file.originalname
          )}`;
          const filePath = path.join(uploadDir, fileName);

          fs.writeFileSync(filePath, req.file.buffer);
          fileUrl = `/uploads/${fileName}`;
        }

        // Update profile with photo URL
        const profile = await storage.getUserProfile(userId);
        if (profile) {
          await storage.createOrUpdateProfile({
            ...profile,
            photoUrl: fileUrl,
          });
        }

        res.json({
          success: true,
          fileUrl,
          message: "Photo uploaded successfully",
        });
      } catch (error) {
        console.error("Error uploading photo:", error);
        res.status(500).json({
          success: false,
          message: "Error uploading photo",
          error:
            process.env.NODE_ENV === "development"
              ? getErrorMessage(error)
              : undefined,
        });
      }
    }
  );

  // S3 presigned URL endpoints
  app.post("/api/upload/presigned-url", requireAuth, async (req, res) => {
    try {
      const { fileName, contentType, folder } = req.body;

      if (!fileName || !contentType) {
        return res.status(400).json({
          success: false,
          message: "fileName and contentType are required",
        });
      }

      if (!S3Service.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: "S3 is not configured",
        });
      }

      const { uploadUrl, key } = await S3Service.generatePresignedUrl(
        fileName,
        contentType,
        folder || "uploads"
      );

      res.json({
        success: true,
        uploadUrl,
        key,
        message: "Presigned URL generated successfully",
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({
        success: false,
        message: "Error generating presigned URL",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Delete file endpoint
  app.delete("/api/upload/delete", requireAuth, async (req, res) => {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({
          success: false,
          message: "fileUrl is required",
        });
      }

      if (S3Service.isConfigured()) {
        // Extract S3 key from URL and delete from S3
        const key = S3Service.extractKeyFromUrl(fileUrl);
        if (key) {
          await S3Service.deleteFile(key);
        }
      } else {
        // For local files, delete from local storage
        const fileName = fileUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "uploads", fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting file",
        error:
          process.env.NODE_ENV === "development"
            ? getErrorMessage(error)
            : undefined,
      });
    }
  });

  // Serve uploaded files (fallback for local storage)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const httpServer = createServer(app);
  return httpServer;
}

import {
  users,
  subscriptions,
  profiles,
  education,
  projects,
  skills,
  experiences,
  creditPurchases,
} from "@shared/schema";
import type {
  User,
  InsertUser,
  Subscription,
  InsertSubscription,
  Profile,
  InsertProfile,
  Education,
  InsertEducation,
  Project,
  InsertProject,
  Skill,
  InsertSkill,
  Experience,
  InsertExperience,
  CreditPurchase,
  InsertCreditPurchase,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { Pool } from "pg";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store that works with local PostgreSQL
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId?: string
  ): Promise<User>;

  // Subscription methods
  getUserSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscriptionCredits(
    userId: string,
    creditsToDeduct: number
  ): Promise<Subscription | null>;

  // Profile methods
  getUserProfile(userId: string): Promise<Profile | undefined>;
  createOrUpdateProfile(profile: InsertProfile): Promise<Profile>;
  getProfileByShareSlug(shareSlug: string): Promise<Profile | undefined>;

  // Education methods
  getUserEducation(userId: string): Promise<Education[]>;
  createEducation(education: InsertEducation): Promise<Education>;
  updateEducation(
    id: string,
    education: Partial<InsertEducation>
  ): Promise<Education | undefined>;
  deleteEducation(id: string): Promise<void>;

  // Project methods
  getUserProjects(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(
    id: string,
    project: Partial<InsertProject>
  ): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  // Skill methods
  getUserSkills(userId: string): Promise<Skill[]>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(
    id: string,
    skill: Partial<InsertSkill>
  ): Promise<Skill | undefined>;
  deleteSkill(id: string): Promise<void>;

  // Experience methods
  getUserExperiences(userId: string): Promise<Experience[]>;
  createExperience(experience: InsertExperience): Promise<Experience>;
  updateExperience(
    id: string,
    experience: Partial<InsertExperience>
  ): Promise<Experience | undefined>;
  deleteExperience(id: string): Promise<void>;

  // Credit purchase methods
  createCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase>;
  addCreditsToSubscription(userId: string, credits: number): Promise<void>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Try both email and username fields since login uses email as username
    const [userByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, username));
    if (userByEmail) return userByEmail;

    const [userByUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return userByUsername || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStripeInfo(
    id: string,
    stripeCustomerId: string,
    stripeSubscriptionId?: string
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        // Add stripe fields to users table if needed
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.userId, userId), eq(subscriptions.active, true))
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return subscription || undefined;
  }

  async createSubscription(
    subscription: InsertSubscription
  ): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async updateSubscriptionCredits(
    userId: string,
    creditsToDeduct: number
  ): Promise<Subscription | null> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription || subscription.creditsRemaining < creditsToDeduct) {
      return null;
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        creditsRemaining: subscription.creditsRemaining - creditsToDeduct,
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();
    return updated;
  }

  async getUserProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return profile || undefined;
  }

  async createOrUpdateProfile(profile: InsertProfile): Promise<Profile> {
    const existing = await this.getUserProfile(profile.userId);

    if (existing) {
      const [updated] = await db
        .update(profiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(profiles.userId, profile.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(profiles).values(profile).returning();
      return created;
    }
  }

  async getProfileByShareSlug(shareSlug: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.shareSlug, shareSlug));
    return profile || undefined;
  }

  async getUserEducation(userId: string): Promise<Education[]> {
    return await db
      .select()
      .from(education)
      .where(eq(education.userId, userId));
  }

  async createEducation(edu: InsertEducation): Promise<Education> {
    const [created] = await db.insert(education).values(edu).returning();
    return created;
  }

  async updateEducation(
    id: string,
    edu: Partial<InsertEducation>
  ): Promise<Education | undefined> {
    const [updated] = await db
      .update(education)
      .set(edu)
      .where(eq(education.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEducation(id: string): Promise<void> {
    await db.delete(education).where(eq(education.id, id));
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(
    id: string,
    project: Partial<InsertProject>
  ): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getUserSkills(userId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.userId, userId));
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const [created] = await db.insert(skills).values(skill).returning();
    return created;
  }

  async updateSkill(
    id: string,
    skill: Partial<InsertSkill>
  ): Promise<Skill | undefined> {
    const [updated] = await db
      .update(skills)
      .set(skill)
      .where(eq(skills.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSkill(id: string): Promise<void> {
    await db.delete(skills).where(eq(skills.id, id));
  }

  async getUserExperiences(userId: string): Promise<Experience[]> {
    return await db
      .select()
      .from(experiences)
      .where(eq(experiences.userId, userId));
  }

  async createExperience(experience: InsertExperience): Promise<Experience> {
    const [created] = await db
      .insert(experiences)
      .values(experience)
      .returning();
    return created;
  }

  async updateExperience(
    id: string,
    experience: Partial<InsertExperience>
  ): Promise<Experience | undefined> {
    const [updated] = await db
      .update(experiences)
      .set(experience)
      .where(eq(experiences.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExperience(id: string): Promise<void> {
    await db.delete(experiences).where(eq(experiences.id, id));
  }

  async createCreditPurchase(
    purchase: InsertCreditPurchase
  ): Promise<CreditPurchase> {
    const [created] = await db
      .insert(creditPurchases)
      .values(purchase)
      .returning();
    return created;
  }

  async addCreditsToSubscription(
    userId: string,
    credits: number
  ): Promise<void> {
    const subscription = await this.getUserSubscription(userId);
    if (subscription) {
      await db
        .update(subscriptions)
        .set({
          creditsRemaining: subscription.creditsRemaining + credits,
        })
        .where(eq(subscriptions.id, subscription.id));
    }
  }
}

export const storage = new DatabaseStorage();

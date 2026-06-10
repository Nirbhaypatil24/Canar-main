import {
  users,
  subscriptions,
  profiles,
  education,
  projects,
  skills,
  experiences,
  creditPurchases,
  refreshTokens,
  candidates,
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
  RefreshToken,
  InsertRefreshToken,
  Candidate,
  InsertCandidate,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, ilike, or, sql, gte, lte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { Pool } from "pg";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store that works with local PostgreSQL
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
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

  // Refresh token methods
  createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;
  deleteExpiredRefreshTokens(olderThanDays?: number): Promise<number>;

  // Login tracking methods
  updateLastLogin(userId: string): Promise<void>;
  incrementFailedLoginAttempts(userId: string): Promise<number>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  lockUserAccount(userId: string, lockMinutes: number): Promise<void>;

  // Ownership check methods
  getEducationOwner(id: string): Promise<string | null>;
  getProjectOwner(id: string): Promise<string | null>;
  getSkillOwner(id: string): Promise<string | null>;
  getExperienceOwner(id: string): Promise<string | null>;

  // Candidate methods
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  getCandidateById(id: string, userId: string): Promise<Candidate | undefined>;
  getCandidatesByUser(userId: string, limit: number, offset: number): Promise<Candidate[]>;
  deleteCandidate(id: string): Promise<void>;
  searchCandidates(userId: string, filters: CandidateSearchFilters): Promise<Candidate[]>;
  bulkCreateCandidates(candidateDataList: InsertCandidate[]): Promise<number>;
  getCandidateStats(userId: string): Promise<CandidateStats>;
  getCandidateOwner(id: string): Promise<string | null>;
  getCandidateCount(userId: string): Promise<number>;

  sessionStore: session.Store;
}

export interface CandidateSearchFilters {
  skills?: string[];
  technologies?: string[];
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  location?: string | null;
  designation?: string | null;
  keywords?: string[];
}

export interface CandidateStats {
  total: number;
  byCvUpload: number;
  byExcelImport: number;
  byManual: number;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
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

  // Refresh token methods

  async createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken> {
    const [created] = await db.insert(refreshTokens).values(token).returning();
    return created;
  }

  async getRefreshTokenByHash(
    tokenHash: string
  ): Promise<RefreshToken | undefined> {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));
    return token || undefined;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, userId));
  }

  async deleteExpiredRefreshTokens(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, cutoff))
      .returning();
    return deleted.length;
  }

  // ─── Login Tracking ─────────────────────────────────────────────────────

  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, userId));
  }

  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;
    const newCount = (user.failedLoginAttempts ?? 0) + 1;
    await db
      .update(users)
      .set({ failedLoginAttempts: newCount })
      .where(eq(users.id, userId));
    return newCount;
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, userId));
  }

  async lockUserAccount(userId: string, lockMinutes: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    await db
      .update(users)
      .set({ lockedUntil })
      .where(eq(users.id, userId));
  }

  // ─── Ownership Checks ──────────────────────────────────────────────────

  async getEducationOwner(id: string): Promise<string | null> {
    const [record] = await db.select({ userId: education.userId }).from(education).where(eq(education.id, id));
    return record?.userId ?? null;
  }

  async getProjectOwner(id: string): Promise<string | null> {
    const [record] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id));
    return record?.userId ?? null;
  }

  async getSkillOwner(id: string): Promise<string | null> {
    const [record] = await db.select({ userId: skills.userId }).from(skills).where(eq(skills.id, id));
    return record?.userId ?? null;
  }

  async getExperienceOwner(id: string): Promise<string | null> {
    const [record] = await db.select({ userId: experiences.userId }).from(experiences).where(eq(experiences.id, id));
    return record?.userId ?? null;
  }

  // ─── Candidate Methods ────────────────────────────────────────────────────

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const [created] = await db.insert(candidates).values(candidate as any).returning();
    return created;
  }

  async getCandidateById(id: string, userId: string): Promise<Candidate | undefined> {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.userId, userId)));
    return candidate || undefined;
  }

  async getCandidatesByUser(userId: string, limit: number = 50, offset: number = 0): Promise<Candidate[]> {
    return await db
      .select()
      .from(candidates)
      .where(eq(candidates.userId, userId))
      .orderBy(desc(candidates.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async deleteCandidate(id: string): Promise<void> {
    await db.delete(candidates).where(eq(candidates.id, id));
  }

  async searchCandidates(userId: string, filters: CandidateSearchFilters): Promise<Candidate[]> {
    const conditions: any[] = [];

    // Location filter
    if (filters.location) {
      conditions.push(ilike(candidates.location, `%${filters.location}%`));
    }

    // Designation filter
    if (filters.designation) {
      conditions.push(ilike(candidates.designation, `%${filters.designation}%`));
    }

    // Experience range filter
    if (filters.minExperienceYears != null) {
      conditions.push(gte(candidates.totalExperienceYears, filters.minExperienceYears));
    }
    if (filters.maxExperienceYears != null) {
      conditions.push(lte(candidates.totalExperienceYears, filters.maxExperienceYears));
    }

    // Skills/technologies/keywords — search in the search_vector text
    const searchTerms = [
      ...(filters.skills || []),
      ...(filters.technologies || []),
      ...(filters.keywords || []),
    ];

    if (searchTerms.length > 0) {
      const termConditions = searchTerms.map((term) =>
        ilike(candidates.searchVector, `%${term.toLowerCase()}%`)
      );
      // All terms must match (AND logic)
      for (const tc of termConditions) {
        conditions.push(tc);
      }
    }

    const query = db
      .select()
      .from(candidates);

    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(candidates.createdAt)).limit(100)
      : await query.orderBy(desc(candidates.createdAt)).limit(100);

    return result;
  }

  async bulkCreateCandidates(candidateDataList: InsertCandidate[]): Promise<number> {
    if (candidateDataList.length === 0) return 0;

    // Insert in batches of 50 to avoid query size limits
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < candidateDataList.length; i += batchSize) {
      const batch = candidateDataList.slice(i, i + batchSize);
      const result = await db.insert(candidates).values(batch as any).returning();
      totalInserted += result.length;
    }

    return totalInserted;
  }

  async getCandidateStats(userId: string): Promise<CandidateStats> {
    const allCandidates = await db
      .select({ source: candidates.source })
      .from(candidates)
      .where(eq(candidates.userId, userId));

    const total = allCandidates.length;
    const byCvUpload = allCandidates.filter((c) => c.source === "cv_upload").length;
    const byExcelImport = allCandidates.filter((c) => c.source === "excel_import").length;
    const byManual = allCandidates.filter((c) => c.source === "manual").length;

    return { total, byCvUpload, byExcelImport, byManual };
  }

  async getCandidateOwner(id: string): Promise<string | null> {
    const [record] = await db
      .select({ userId: candidates.userId })
      .from(candidates)
      .where(eq(candidates.id, id));
    return record?.userId ?? null;
  }

  async getCandidateCount(userId: string): Promise<number> {
    const result = await db
      .select({ source: candidates.source })
      .from(candidates)
      .where(eq(candidates.userId, userId));
    return result.length;
  }
}

export const storage = new DatabaseStorage();

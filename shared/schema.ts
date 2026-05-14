import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  username: varchar("username", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  planType: varchar("plan_type", { length: 20 }).notNull(), // 'Basic' or 'Premium'
  creditsAllocated: integer("credits_allocated").notNull(),
  creditsRemaining: integer("credits_remaining").notNull(),
  active: boolean("active").default(true),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditPurchases = pgTable("credit_purchases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  credits: integer("credits").notNull(),
  amount: integer("amount").notNull(), // Amount in paise
  purchaseDate: timestamp("purchase_date").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  cvUrl: text("cv_url"),
  shareSlug: varchar("share_slug", { length: 100 }).unique(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const education = pgTable("education", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  degree: varchar("degree", { length: 255 }),
  university: varchar("university", { length: 255 }),
  duration: varchar("duration", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  link: text("link"),
  duration: varchar("duration", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }),
  proficiency: varchar("proficiency", { length: 50 }), // 'Beginner', 'Intermediate', 'Advanced', 'Expert'
  createdAt: timestamp("created_at").defaultNow(),
});

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 255 }),
  company: varchar("company", { length: 255 }),
  duration: varchar("duration", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions),
  profile: one(profiles),
  education: many(education),
  projects: many(projects),
  skills: many(skills),
  experiences: many(experiences),
  creditPurchases: many(creditPurchases),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const educationRelations = relations(education, ({ one }) => ({
  user: one(users, { fields: [education.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
}));

export const skillsRelations = relations(skills, ({ one }) => ({
  user: one(users, { fields: [skills.userId], references: [users.id] }),
}));

export const experiencesRelations = relations(experiences, ({ one }) => ({
  user: one(users, { fields: [experiences.userId], references: [users.id] }),
}));

export const creditPurchasesRelations = relations(creditPurchases, ({ one }) => ({
  user: one(users, { fields: [creditPurchases.userId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationSchema = createInsertSchema(education).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});

export const insertExperienceSchema = createInsertSchema(experiences).omit({
  id: true,
  createdAt: true,
});

export const insertCreditPurchaseSchema = createInsertSchema(creditPurchases).omit({
  id: true,
  purchaseDate: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Education = typeof education.$inferSelect;
export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Experience = typeof experiences.$inferSelect;
export type InsertExperience = z.infer<typeof insertExperienceSchema>;
export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type InsertCreditPurchase = z.infer<typeof insertCreditPurchaseSchema>;

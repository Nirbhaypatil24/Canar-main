var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/pdf-parser.ts
var pdf_parser_exports = {};
__export(pdf_parser_exports, {
  extractTextFromPdf: () => extractTextFromPdf
});
import { createRequire } from "module";
async function extractTextFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        "No text could be extracted from this PDF. It may be an image-only or scanned document."
      );
    }
    const cleanedText = data.text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    return {
      text: cleanedText,
      numPages: data.numpages,
      info: data.info || {}
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("password") || error.message.includes("encrypted")) {
        throw new Error(
          "This PDF is password-protected or encrypted. Please upload an unprotected PDF."
        );
      }
      if (error.message.includes("Invalid PDF")) {
        throw new Error(
          "The uploaded file is not a valid PDF. Please check the file and try again."
        );
      }
      throw error;
    }
    throw new Error("An unexpected error occurred while parsing the PDF.");
  }
}
var require2, pdfParse;
var init_pdf_parser = __esm({
  "server/pdf-parser.ts"() {
    "use strict";
    require2 = createRequire(import.meta.url);
    pdfParse = require2("pdf-parse/lib/pdf-parse");
  }
});

// server/ai-service.ts
var ai_service_exports = {};
__export(ai_service_exports, {
  ParsedCandidateSchema: () => ParsedCandidateSchema,
  buildSearchVector: () => buildSearchVector,
  extractSearchIntent: () => extractSearchIntent,
  parseCvWithAI: () => parseCvWithAI
});
import Groq from "groq-sdk";
import { z as z2 } from "zod";
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Please add it to your .env file to enable AI features."
    );
  }
  return new Groq({ apiKey });
}
async function parseCvWithAI(cvText) {
  const groq = getGroqClient();
  const maxRetries = 2;
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const truncatedText = cvText.length > 15e3 ? cvText.slice(0, 15e3) + "\n...[truncated]" : cvText;
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: CV_PARSE_PROMPT + truncatedText
          }
        ],
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      });
      let text2 = chatCompletion.choices[0]?.message?.content?.trim() || "";
      if (text2.startsWith("```")) {
        text2 = text2.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(text2);
      const validated = ParsedCandidateSchema.parse(parsed);
      return validated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message || "";
      console.error(
        `AI CV parsing attempt ${attempt + 1} failed:`,
        msg
      );
      if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("Too Many Requests")) {
        throw new Error(
          "Groq API rate limit exceeded. Please wait a minute and try again."
        );
      }
      if (msg.includes("invalid_api_key") || msg.includes("401") || msg.includes("Unauthorized")) {
        throw new Error(
          "Invalid Groq API key. Please get a valid key from https://console.groq.com/keys and update GROQ_API_KEY in your .env file."
        );
      }
      if (attempt < maxRetries) {
        await new Promise(
          (resolve2) => setTimeout(resolve2, 1e3 * Math.pow(2, attempt))
        );
      }
    }
  }
  throw new Error(
    `Failed to parse CV after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`
  );
}
async function extractSearchIntent(query) {
  const groq = getGroqClient();
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: SEARCH_INTENT_PROMPT + query
        }
      ],
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });
    let text2 = chatCompletion.choices[0]?.message?.content?.trim() || "";
    if (text2.startsWith("```")) {
      text2 = text2.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(text2);
    return SearchIntentSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to extract search intent:", error);
    return {
      skills: [],
      technologies: [],
      minExperienceYears: null,
      maxExperienceYears: null,
      location: null,
      designation: null,
      keywords: query.split(/\s+/).filter((w) => w.length > 2)
    };
  }
}
function buildSearchVector(data) {
  const parts = [];
  if (data.fullName) parts.push(data.fullName);
  if (data.designation) parts.push(data.designation);
  if (data.location) parts.push(data.location);
  if (data.summary) parts.push(data.summary);
  if (data.skills?.length) parts.push(data.skills.join(" "));
  if (data.technologies?.length) parts.push(data.technologies.join(" "));
  if (data.certifications?.length) parts.push(data.certifications.join(" "));
  if (data.languages?.length) parts.push(data.languages.join(" "));
  if (data.experience?.length) {
    for (const exp of data.experience) {
      parts.push(`${exp.role} ${exp.company} ${exp.description}`);
    }
  }
  if (data.education?.length) {
    for (const edu of data.education) {
      parts.push(`${edu.degree} ${edu.institution}`);
    }
  }
  if (data.projects?.length) {
    for (const proj of data.projects) {
      parts.push(
        `${proj.name} ${proj.description} ${proj.technologies?.join(" ") || ""}`
      );
    }
  }
  return parts.join(" ").toLowerCase();
}
var nullToEmpty, nullToEmptyArray, ExperienceItemSchema, EducationItemSchema, ProjectItemSchema, ParsedCandidateSchema, SearchIntentSchema, GROQ_MODEL, CV_PARSE_PROMPT, SEARCH_INTENT_PROMPT;
var init_ai_service = __esm({
  "server/ai-service.ts"() {
    "use strict";
    nullToEmpty = (val) => val === null || val === void 0 ? "" : val;
    nullToEmptyArray = (val) => val === null || val === void 0 ? [] : val;
    ExperienceItemSchema = z2.object({
      role: z2.preprocess(nullToEmpty, z2.string().default("")),
      company: z2.preprocess(nullToEmpty, z2.string().default("")),
      duration: z2.preprocess(nullToEmpty, z2.string().default("")),
      description: z2.preprocess(nullToEmpty, z2.string().default(""))
    });
    EducationItemSchema = z2.object({
      degree: z2.preprocess(nullToEmpty, z2.string().default("")),
      institution: z2.preprocess(nullToEmpty, z2.string().default("")),
      year: z2.preprocess(nullToEmpty, z2.string().default(""))
    });
    ProjectItemSchema = z2.object({
      name: z2.preprocess(nullToEmpty, z2.string().default("")),
      description: z2.preprocess(nullToEmpty, z2.string().default("")),
      technologies: z2.preprocess(nullToEmptyArray, z2.array(z2.string()).default([]))
    });
    ParsedCandidateSchema = z2.object({
      fullName: z2.string().nullable().default(null),
      email: z2.string().nullable().default(null),
      phone: z2.string().nullable().default(null),
      location: z2.string().nullable().default(null),
      designation: z2.string().nullable().default(null),
      summary: z2.string().nullable().default(null),
      totalExperienceYears: z2.number().int().nullable().default(null),
      skills: z2.array(z2.string()).default([]),
      technologies: z2.array(z2.string()).default([]),
      experience: z2.array(ExperienceItemSchema).default([]),
      education: z2.array(EducationItemSchema).default([]),
      projects: z2.array(ProjectItemSchema).default([]),
      certifications: z2.array(z2.string()).default([]),
      languages: z2.array(z2.string()).default([])
    });
    SearchIntentSchema = z2.object({
      skills: z2.array(z2.string()).default([]),
      technologies: z2.array(z2.string()).default([]),
      minExperienceYears: z2.number().nullable().default(null),
      maxExperienceYears: z2.number().nullable().default(null),
      location: z2.string().nullable().default(null),
      designation: z2.string().nullable().default(null),
      keywords: z2.array(z2.string()).default([])
    });
    GROQ_MODEL = "llama-3.3-70b-versatile";
    CV_PARSE_PROMPT = `You are an expert resume/CV parser. Analyze the following resume text and extract structured information.

Return ONLY valid JSON (no markdown, no code blocks, no extra text) with the following structure:
{
  "fullName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "city, state/country or null",
  "designation": "current or most recent job title or null",
  "summary": "professional summary in 2-3 sentences or null",
  "totalExperienceYears": number or null (calculate from work history),
  "skills": ["skill1", "skill2", ...],
  "technologies": ["tech1", "tech2", ...],
  "experience": [
    {
      "role": "job title",
      "company": "company name",
      "duration": "start - end",
      "description": "brief responsibilities"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "university/college",
      "year": "graduation year or duration"
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "brief description",
      "technologies": ["tech1", "tech2"]
    }
  ],
  "certifications": ["cert1", "cert2", ...],
  "languages": ["language1", "language2", ...]
}

Important:
- Extract ALL skills and technologies mentioned, including those embedded in project/experience descriptions
- Separate "skills" (soft skills, methodologies like Agile, Scrum) from "technologies" (programming languages, frameworks, tools)
- Calculate totalExperienceYears by summing up work experience durations
- If a field cannot be determined, use null for strings/numbers or [] for arrays
- Return ONLY the JSON object, nothing else

Resume text:
`;
    SEARCH_INTENT_PROMPT = `You are an expert at understanding recruiter search queries. Analyze the following natural language search query and extract the search intent.

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "skills": ["skill1", "skill2"],
  "technologies": ["tech1", "tech2"],
  "minExperienceYears": number or null,
  "maxExperienceYears": number or null,
  "location": "city/region or null",
  "designation": "job title or null",
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- "3+ years" means minExperienceYears=3, maxExperienceYears=null
- "2-5 years" means minExperienceYears=2, maxExperienceYears=5
- "senior" in context implies minExperienceYears=5 if no explicit years given
- "junior" implies maxExperienceYears=2
- Technologies are specific: React, Node.js, AWS, Docker, Python, Java, etc.
- Skills are broader: leadership, problem-solving, communication, Agile, etc.
- keywords contains any other important search terms
- Return ONLY the JSON object, nothing else

Search query: `;
  }
});

// server/excel-import.ts
var excel_import_exports = {};
__export(excel_import_exports, {
  excelRowToCandidateData: () => excelRowToCandidateData,
  parseExcelBuffer: () => parseExcelBuffer
});
import * as XLSX from "xlsx";
function parseExcelBuffer(buffer, fileName) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded file contains no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });
  if (rawRows.length === 0) {
    throw new Error("The uploaded file contains no data rows.");
  }
  const firstRow = rawRows[0];
  const headerMap = {};
  for (const header of Object.keys(firstRow)) {
    const normalizedHeader = header.toLowerCase().trim();
    const mappedField = COLUMN_MAP[normalizedHeader];
    if (mappedField) {
      headerMap[header] = mappedField;
    }
  }
  if (Object.keys(headerMap).length === 0) {
    throw new Error(
      "Could not map any column headers. Expected columns like: Name, Email, Phone, Skills, Location, Experience, etc."
    );
  }
  const rows = [];
  const errors = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row = {};
    try {
      for (const [originalHeader, fieldName] of Object.entries(headerMap)) {
        const value = raw[originalHeader];
        if (value !== void 0 && value !== null && value !== "") {
          if (fieldName === "totalExperienceYears") {
            const num = parseInt(String(value), 10);
            row[fieldName] = isNaN(num) ? void 0 : num;
          } else {
            row[fieldName] = String(value).trim();
          }
        }
      }
      if (!row.fullName && !row.email) {
        errors.push({
          row: i + 2,
          // +2 for header row + 1-based index
          message: "Row must have at least a name or email."
        });
        continue;
      }
      rows.push(row);
    } catch (error) {
      errors.push({
        row: i + 2,
        message: error instanceof Error ? error.message : "Unknown error parsing row"
      });
    }
  }
  return { rows, errors };
}
function excelRowToCandidateData(row, userId) {
  const splitCsv = (value) => {
    if (!value) return [];
    return value.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length > 0);
  };
  const skills3 = splitCsv(row.skills);
  const technologies = splitCsv(row.technologies);
  const certifications = splitCsv(row.certifications);
  const languages = splitCsv(row.languages);
  const experience = [];
  if (row.company || row.currentRole) {
    experience.push({
      role: row.currentRole || row.designation || "",
      company: row.company || "",
      duration: row.totalExperienceYears ? `${row.totalExperienceYears} years` : "",
      description: ""
    });
  }
  const searchParts = [
    row.fullName,
    row.designation,
    row.location,
    row.summary,
    ...skills3,
    ...technologies,
    ...certifications,
    ...languages,
    row.company,
    row.currentRole
  ].filter(Boolean);
  return {
    userId,
    fullName: row.fullName || null,
    email: row.email || null,
    phone: row.phone || null,
    location: row.location || null,
    designation: row.designation || row.currentRole || null,
    summary: row.summary || null,
    totalExperienceYears: row.totalExperienceYears ?? null,
    skills: skills3.length > 0 ? skills3 : null,
    technologies: technologies.length > 0 ? technologies : null,
    experience: experience.length > 0 ? experience : null,
    education: null,
    projects: null,
    certifications: certifications.length > 0 ? certifications : null,
    languages: languages.length > 0 ? languages : null,
    source: "excel_import",
    searchVector: searchParts.join(" ").toLowerCase()
  };
}
var COLUMN_MAP;
var init_excel_import = __esm({
  "server/excel-import.ts"() {
    "use strict";
    COLUMN_MAP = {
      // Full Name
      "name": "fullName",
      "full name": "fullName",
      "full_name": "fullName",
      "fullname": "fullName",
      "candidate name": "fullName",
      "candidate": "fullName",
      // Email
      "email": "email",
      "email address": "email",
      "email_address": "email",
      "e-mail": "email",
      "mail": "email",
      // Phone
      "phone": "phone",
      "phone number": "phone",
      "phone_number": "phone",
      "mobile": "phone",
      "mobile number": "phone",
      "contact": "phone",
      "contact number": "phone",
      // Location
      "location": "location",
      "city": "location",
      "address": "location",
      "place": "location",
      // Designation
      "designation": "designation",
      "title": "designation",
      "job title": "designation",
      "job_title": "designation",
      "position": "designation",
      "role": "designation",
      "current role": "designation",
      "current_role": "currentRole",
      // Summary
      "summary": "summary",
      "about": "summary",
      "bio": "summary",
      "profile summary": "summary",
      "objective": "summary",
      // Experience
      "experience": "totalExperienceYears",
      "experience (years)": "totalExperienceYears",
      "total experience": "totalExperienceYears",
      "total_experience": "totalExperienceYears",
      "years of experience": "totalExperienceYears",
      "yoe": "totalExperienceYears",
      "exp": "totalExperienceYears",
      // Skills
      "skills": "skills",
      "skill set": "skills",
      "skill_set": "skills",
      "key skills": "skills",
      "key_skills": "skills",
      // Technologies
      "technologies": "technologies",
      "tech stack": "technologies",
      "tech_stack": "technologies",
      "tools": "technologies",
      "programming languages": "technologies",
      // Certifications
      "certifications": "certifications",
      "certificates": "certifications",
      "certification": "certifications",
      // Languages
      "languages": "languages",
      "language": "languages",
      // Company
      "company": "company",
      "current company": "company",
      "organization": "company",
      "employer": "company"
    };
  }
});

// api/index.ts
import express2 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  candidates: () => candidates,
  candidatesRelations: () => candidatesRelations,
  creditPurchases: () => creditPurchases,
  creditPurchasesRelations: () => creditPurchasesRelations,
  education: () => education,
  educationRelations: () => educationRelations,
  experiences: () => experiences,
  experiencesRelations: () => experiencesRelations,
  insertCandidateSchema: () => insertCandidateSchema,
  insertCreditPurchaseSchema: () => insertCreditPurchaseSchema,
  insertEducationSchema: () => insertEducationSchema,
  insertExperienceSchema: () => insertExperienceSchema,
  insertProfileSchema: () => insertProfileSchema,
  insertProjectSchema: () => insertProjectSchema,
  insertRefreshTokenSchema: () => insertRefreshTokenSchema,
  insertSkillSchema: () => insertSkillSchema,
  insertSubscriptionSchema: () => insertSubscriptionSchema,
  insertUserSchema: () => insertUserSchema,
  profiles: () => profiles,
  profilesRelations: () => profilesRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  refreshTokens: () => refreshTokens,
  refreshTokensRelations: () => refreshTokensRelations,
  skills: () => skills,
  skillsRelations: () => skillsRelations,
  subscriptions: () => subscriptions,
  subscriptionsRelations: () => subscriptionsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  username: varchar("username", { length: 100 }),
  role: varchar("role", { length: 20 }).default("candidate").notNull(),
  // 'candidate' or 'recruiter'
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow()
});
var subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  planType: varchar("plan_type", { length: 20 }).notNull(),
  // 'Basic' or 'Premium'
  creditsAllocated: integer("credits_allocated").notNull(),
  creditsRemaining: integer("credits_remaining").notNull(),
  active: boolean("active").default(true),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow()
});
var creditPurchases = pgTable("credit_purchases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  credits: integer("credits").notNull(),
  amount: integer("amount").notNull(),
  // Amount in paise
  purchaseDate: timestamp("purchase_date").defaultNow()
});
var profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  cvUrl: text("cv_url"),
  shareSlug: varchar("share_slug", { length: 100 }).unique(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
});
var education = pgTable("education", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  degree: varchar("degree", { length: 255 }),
  university: varchar("university", { length: 255 }),
  duration: varchar("duration", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow()
});
var projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  link: text("link"),
  duration: varchar("duration", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow()
});
var skills = pgTable("skills", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }),
  proficiency: varchar("proficiency", { length: 50 }),
  // 'Beginner', 'Intermediate', 'Advanced', 'Expert'
  createdAt: timestamp("created_at").defaultNow()
});
var experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 255 }),
  company: varchar("company", { length: 255 }),
  duration: varchar("duration", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});
var refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow()
});
var candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Core parsed fields
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("candidate_email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  location: varchar("location", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  summary: text("summary"),
  totalExperienceYears: integer("total_experience_years"),
  // Structured data stored as JSONB
  skills: jsonb("skills").$type(),
  technologies: jsonb("technologies").$type(),
  experience: jsonb("experience").$type(),
  education: jsonb("candidate_education").$type(),
  projects: jsonb("candidate_projects").$type(),
  certifications: jsonb("certifications").$type(),
  languages: jsonb("languages").$type(),
  // Source tracking
  cvUrl: text("cv_url"),
  cvFileName: varchar("cv_file_name", { length: 255 }),
  source: varchar("source", { length: 50 }).default("cv_upload"),
  // 'cv_upload' | 'excel_import' | 'manual'
  rawParsedData: jsonb("raw_parsed_data"),
  // Search optimization
  searchVector: text("search_vector"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions),
  profile: one(profiles),
  education: many(education),
  projects: many(projects),
  skills: many(skills),
  experiences: many(experiences),
  creditPurchases: many(creditPurchases),
  refreshTokens: many(refreshTokens),
  candidates: many(candidates)
}));
var subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] })
}));
var profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] })
}));
var educationRelations = relations(education, ({ one }) => ({
  user: one(users, { fields: [education.userId], references: [users.id] })
}));
var projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] })
}));
var skillsRelations = relations(skills, ({ one }) => ({
  user: one(users, { fields: [skills.userId], references: [users.id] })
}));
var experiencesRelations = relations(experiences, ({ one }) => ({
  user: one(users, { fields: [experiences.userId], references: [users.id] })
}));
var creditPurchasesRelations = relations(creditPurchases, ({ one }) => ({
  user: one(users, { fields: [creditPurchases.userId], references: [users.id] })
}));
var refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] })
}));
var candidatesRelations = relations(candidates, ({ one }) => ({
  user: one(users, { fields: [candidates.userId], references: [users.id] })
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true
});
var insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertEducationSchema = createInsertSchema(education).omit({
  id: true,
  createdAt: true
});
var insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true
});
var insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true
});
var insertExperienceSchema = createInsertSchema(experiences).omit({
  id: true,
  createdAt: true
});
var insertCreditPurchaseSchema = createInsertSchema(creditPurchases).omit({
  id: true,
  purchaseDate: true
});
var insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true
});
var insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
var __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc, lt, ilike, gte, lte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool as Pool2 } from "pg";
var PostgresSessionStore = connectPg(session);
var sessionPool = new Pool2({
  connectionString: process.env.DATABASE_URL
});
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true
    });
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [userByEmail] = await db.select().from(users).where(eq(users.email, username));
    if (userByEmail) return userByEmail;
    const [userByUsername] = await db.select().from(users).where(eq(users.username, username));
    return userByUsername || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserStripeInfo(id, stripeCustomerId, stripeSubscriptionId) {
    const [user] = await db.update(users).set({
      // Add stripe fields to users table if needed
    }).where(eq(users.id, id)).returning();
    return user;
  }
  async getUserSubscription(userId) {
    const [subscription] = await db.select().from(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.active, true))
    ).orderBy(desc(subscriptions.createdAt)).limit(1);
    return subscription || void 0;
  }
  async createSubscription(subscription) {
    const [newSubscription] = await db.insert(subscriptions).values(subscription).returning();
    return newSubscription;
  }
  async updateSubscriptionCredits(userId, creditsToDeduct) {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription || subscription.creditsRemaining < creditsToDeduct) {
      return null;
    }
    const [updated] = await db.update(subscriptions).set({
      creditsRemaining: subscription.creditsRemaining - creditsToDeduct
    }).where(eq(subscriptions.id, subscription.id)).returning();
    return updated;
  }
  async getUserProfile(userId) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile || void 0;
  }
  async createOrUpdateProfile(profile) {
    const existing = await this.getUserProfile(profile.userId);
    if (existing) {
      const [updated] = await db.update(profiles).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq(profiles.userId, profile.userId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(profiles).values(profile).returning();
      return created;
    }
  }
  async getProfileByShareSlug(shareSlug) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.shareSlug, shareSlug));
    return profile || void 0;
  }
  async getUserEducation(userId) {
    return await db.select().from(education).where(eq(education.userId, userId));
  }
  async createEducation(edu) {
    const [created] = await db.insert(education).values(edu).returning();
    return created;
  }
  async updateEducation(id, edu) {
    const [updated] = await db.update(education).set(edu).where(eq(education.id, id)).returning();
    return updated || void 0;
  }
  async deleteEducation(id) {
    await db.delete(education).where(eq(education.id, id));
  }
  async getUserProjects(userId) {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }
  async createProject(project) {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }
  async updateProject(id, project) {
    const [updated] = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return updated || void 0;
  }
  async deleteProject(id) {
    await db.delete(projects).where(eq(projects.id, id));
  }
  async getUserSkills(userId) {
    return await db.select().from(skills).where(eq(skills.userId, userId));
  }
  async createSkill(skill) {
    const [created] = await db.insert(skills).values(skill).returning();
    return created;
  }
  async updateSkill(id, skill) {
    const [updated] = await db.update(skills).set(skill).where(eq(skills.id, id)).returning();
    return updated || void 0;
  }
  async deleteSkill(id) {
    await db.delete(skills).where(eq(skills.id, id));
  }
  async getUserExperiences(userId) {
    return await db.select().from(experiences).where(eq(experiences.userId, userId));
  }
  async createExperience(experience) {
    const [created] = await db.insert(experiences).values(experience).returning();
    return created;
  }
  async updateExperience(id, experience) {
    const [updated] = await db.update(experiences).set(experience).where(eq(experiences.id, id)).returning();
    return updated || void 0;
  }
  async deleteExperience(id) {
    await db.delete(experiences).where(eq(experiences.id, id));
  }
  async createCreditPurchase(purchase) {
    const [created] = await db.insert(creditPurchases).values(purchase).returning();
    return created;
  }
  async addCreditsToSubscription(userId, credits) {
    const subscription = await this.getUserSubscription(userId);
    if (subscription) {
      await db.update(subscriptions).set({
        creditsRemaining: subscription.creditsRemaining + credits
      }).where(eq(subscriptions.id, subscription.id));
    }
  }
  // Refresh token methods
  async createRefreshToken(token) {
    const [created] = await db.insert(refreshTokens).values(token).returning();
    return created;
  }
  async getRefreshTokenByHash(tokenHash) {
    const [token] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    return token || void 0;
  }
  async revokeRefreshToken(id) {
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, id));
  }
  async revokeAllUserRefreshTokens(userId) {
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
  }
  async deleteExpiredRefreshTokens(olderThanDays = 30) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1e3);
    const deleted = await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, cutoff)).returning();
    return deleted.length;
  }
  // ─── Login Tracking ─────────────────────────────────────────────────────
  async updateLastLogin(userId) {
    await db.update(users).set({ lastLoginAt: /* @__PURE__ */ new Date(), failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
  }
  async incrementFailedLoginAttempts(userId) {
    const user = await this.getUser(userId);
    if (!user) return 0;
    const newCount = (user.failedLoginAttempts ?? 0) + 1;
    await db.update(users).set({ failedLoginAttempts: newCount }).where(eq(users.id, userId));
    return newCount;
  }
  async resetFailedLoginAttempts(userId) {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
  }
  async lockUserAccount(userId, lockMinutes) {
    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1e3);
    await db.update(users).set({ lockedUntil }).where(eq(users.id, userId));
  }
  // ─── Ownership Checks ──────────────────────────────────────────────────
  async getEducationOwner(id) {
    const [record] = await db.select({ userId: education.userId }).from(education).where(eq(education.id, id));
    return record?.userId ?? null;
  }
  async getProjectOwner(id) {
    const [record] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id));
    return record?.userId ?? null;
  }
  async getSkillOwner(id) {
    const [record] = await db.select({ userId: skills.userId }).from(skills).where(eq(skills.id, id));
    return record?.userId ?? null;
  }
  async getExperienceOwner(id) {
    const [record] = await db.select({ userId: experiences.userId }).from(experiences).where(eq(experiences.id, id));
    return record?.userId ?? null;
  }
  // ─── Candidate Methods ────────────────────────────────────────────────────
  async createCandidate(candidate) {
    const [created] = await db.insert(candidates).values(candidate).returning();
    return created;
  }
  async getCandidateById(id, userId) {
    const [candidate] = await db.select().from(candidates).where(and(eq(candidates.id, id), eq(candidates.userId, userId)));
    return candidate || void 0;
  }
  async getCandidatesByUser(userId, limit = 50, offset = 0) {
    return await db.select().from(candidates).where(eq(candidates.userId, userId)).orderBy(desc(candidates.createdAt)).limit(limit).offset(offset);
  }
  async deleteCandidate(id) {
    await db.delete(candidates).where(eq(candidates.id, id));
  }
  async searchCandidates(userId, filters) {
    const conditions = [];
    if (filters.location) {
      conditions.push(ilike(candidates.location, `%${filters.location}%`));
    }
    if (filters.designation) {
      conditions.push(ilike(candidates.designation, `%${filters.designation}%`));
    }
    if (filters.minExperienceYears != null) {
      conditions.push(gte(candidates.totalExperienceYears, filters.minExperienceYears));
    }
    if (filters.maxExperienceYears != null) {
      conditions.push(lte(candidates.totalExperienceYears, filters.maxExperienceYears));
    }
    const searchTerms = [
      ...filters.skills || [],
      ...filters.technologies || [],
      ...filters.keywords || []
    ];
    if (searchTerms.length > 0) {
      const termConditions = searchTerms.map(
        (term) => ilike(candidates.searchVector, `%${term.toLowerCase()}%`)
      );
      for (const tc of termConditions) {
        conditions.push(tc);
      }
    }
    const query = db.select().from(candidates);
    const result = conditions.length > 0 ? await query.where(and(...conditions)).orderBy(desc(candidates.createdAt)).limit(100) : await query.orderBy(desc(candidates.createdAt)).limit(100);
    return result;
  }
  async bulkCreateCandidates(candidateDataList) {
    if (candidateDataList.length === 0) return 0;
    const batchSize = 50;
    let totalInserted = 0;
    for (let i = 0; i < candidateDataList.length; i += batchSize) {
      const batch = candidateDataList.slice(i, i + batchSize);
      const result = await db.insert(candidates).values(batch).returning();
      totalInserted += result.length;
    }
    return totalInserted;
  }
  async getCandidateStats(userId) {
    const allCandidates = await db.select({ source: candidates.source }).from(candidates).where(eq(candidates.userId, userId));
    const total = allCandidates.length;
    const byCvUpload = allCandidates.filter((c) => c.source === "cv_upload").length;
    const byExcelImport = allCandidates.filter((c) => c.source === "excel_import").length;
    const byManual = allCandidates.filter((c) => c.source === "manual").length;
    return { total, byCvUpload, byExcelImport, byManual };
  }
  async getCandidateOwner(id) {
    const [record] = await db.select({ userId: candidates.userId }).from(candidates).where(eq(candidates.id, id));
    return record?.userId ?? null;
  }
  async getCandidateCount(userId) {
    const result = await db.select({ source: candidates.source }).from(candidates).where(eq(candidates.userId, userId));
    return result.length;
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { z } from "zod";
var scryptAsync = promisify(scrypt);
var JWT_SECRET = process.env.JWT_SECRET;
var JWT_ACCESS_EXPIRES_IN = "15m";
var REFRESH_TOKEN_DAYS = 7;
var SESSION_SECRET = process.env.SESSION_SECRET;
var JWT_ISSUER = "canar-api";
var JWT_AUDIENCE = "canar-client";
if (process.env.NODE_ENV === "production") {
  if (!JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET must be set in production");
  }
  if (!SESSION_SECRET) {
    throw new Error("FATAL: SESSION_SECRET must be set in production");
  }
}
var EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-jwt-secret-NOT-FOR-PRODUCTION";
var EFFECTIVE_SESSION_SECRET = SESSION_SECRET || "dev-session-secret-NOT-FOR-PRODUCTION";
var AUTH_STRATEGY = process.env.AUTH_STRATEGY || "jwt";
var MAX_FAILED_ATTEMPTS = parseInt(
  process.env.MAX_FAILED_LOGIN_ATTEMPTS || "10",
  10
);
var LOCKOUT_MINUTES = parseInt(
  process.env.ACCOUNT_LOCKOUT_MINUTES || "30",
  10
);
var TOKEN_CLEANUP_INTERVAL = parseInt(
  process.env.TOKEN_CLEANUP_INTERVAL_HOURS || "6",
  10
);
var passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be at most 128 characters").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one number");
var registerSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  username: z.string().max(100).optional(),
  password: passwordSchema,
  role: z.enum(["candidate", "recruiter"]).default("candidate")
});
var loginSchema = z.object({
  username: z.string().min(1, "Username/email is required").max(255),
  password: z.string().min(1, "Password is required").max(128)
});
var BLOCKED_PASSWORDS = /* @__PURE__ */ new Set([
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
  "Qwerty123"
]);
function auditLog(event, details) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event,
    ...details
  };
  console.log(`[AUTH_AUDIT] ${JSON.stringify(entry)}`);
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.id,
    // Each user is their own tenant
    type: "access"
  };
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: randomBytes(16).toString("hex")
    // Unique token ID
  });
}
function generateRefreshToken() {
  return randomBytes(40).toString("hex");
}
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.jwt || null;
}
function requireAuth(req, res, next) {
  if (AUTH_STRATEGY === "session") {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }
  if (AUTH_STRATEGY === "hybrid") {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
  }
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      message: "No token provided"
    });
    return;
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
    return;
  }
  req.user = { id: payload.id, email: payload.email, role: payload.role };
  next();
}
function requireTenantAccess(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }
  const requestedUserId = req.params.userId || req.body?.userId || req.query?.userId;
  if (requestedUserId && String(requestedUserId) !== String(userId)) {
    res.status(403).json({
      success: false,
      message: "Access denied: tenant isolation violation"
    });
    return;
  }
  next();
}
function startTokenCleanup() {
  const intervalMs = TOKEN_CLEANUP_INTERVAL * 60 * 60 * 1e3;
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
  cleanup();
  setInterval(cleanup, intervalMs);
}
function setupAuth(app2) {
  if (AUTH_STRATEGY !== "jwt") {
    const sessionSettings = {
      secret: EFFECTIVE_SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1e3,
        // 24 hours
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax"
      },
      name: "connect.sid"
    };
    app2.use(session2(sessionSettings));
    app2.use(passport.initialize());
    app2.use(passport.session());
  } else {
    app2.use(passport.initialize());
  }
  passport.use(
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false, { message: "Invalid credentials" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
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
  startTokenCleanup();
  app2.post("/api/register", async (req, res, next) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map((e) => e.message);
        auditLog("REGISTER_FAILED", {
          email: req.body?.email,
          ip: getClientIp(req),
          reason: errors.join("; ")
        });
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors
        });
      }
      const { email, username, password, role } = parseResult.data;
      if (BLOCKED_PASSWORDS.has(password) || BLOCKED_PASSWORDS.has(password.toLowerCase())) {
        auditLog("PASSWORD_REJECTED", {
          email,
          ip: getClientIp(req),
          reason: "Common password blocked"
        });
        return res.status(400).json({
          success: false,
          message: "This password is too common. Please choose a stronger password."
        });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        auditLog("REGISTER_FAILED", {
          email,
          ip: getClientIp(req),
          reason: "Email already exists"
        });
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
      const user = await storage.createUser({
        email,
        username: username || email,
        password: await hashPassword(password),
        role
      });
      auditLog("REGISTER_SUCCESS", {
        userId: user.id,
        email: user.email,
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"]
      });
      if (AUTH_STRATEGY === "jwt") {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const expiresAt = new Date(
          Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3
        );
        await storage.createRefreshToken({
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt,
          userAgent: req.headers["user-agent"] || null,
          ipAddress: getClientIp(req)
        });
        res.cookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
          maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3,
          path: "/api/auth"
        });
        return res.status(201).json({
          success: true,
          user: sanitizeUser(user),
          token: accessToken,
          message: "Registration successful"
        });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        const response = {
          success: true,
          user: sanitizeUser(user),
          message: "Registration successful"
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
        message: "Internal server error"
      });
    }
  });
  app2.post("/api/login", async (req, res, next) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: parseResult.error.errors.map((e) => e.message)
        });
      }
      const { username } = parseResult.data;
      const targetUser = await storage.getUserByUsername(username);
      if (targetUser?.lockedUntil && /* @__PURE__ */ new Date() < targetUser.lockedUntil) {
        const remainingMs = targetUser.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 6e4);
        auditLog("LOGIN_LOCKED", {
          userId: targetUser.id,
          email: targetUser.email,
          ip: getClientIp(req),
          userAgent: req.headers["user-agent"],
          reason: `Account locked for ${remainingMin} more minutes`
        });
        return res.status(423).json({
          success: false,
          message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`
        });
      }
      passport.authenticate(
        "local",
        async (err, user, info) => {
          if (err) return next(err);
          if (!user) {
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
                  reason: `Locked after ${attempts} failed attempts`
                });
              }
            }
            auditLog("LOGIN_FAILED", {
              email: username,
              ip: getClientIp(req),
              userAgent: req.headers["user-agent"],
              reason: info?.message || "Invalid credentials"
            });
            return res.status(401).json({
              success: false,
              message: "Invalid credentials"
            });
          }
          await storage.updateLastLogin(user.id);
          auditLog("LOGIN_SUCCESS", {
            userId: user.id,
            email: user.email,
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"]
          });
          if (AUTH_STRATEGY === "jwt") {
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken();
            const expiresAt = new Date(
              Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3
            );
            await storage.createRefreshToken({
              userId: user.id,
              tokenHash: hashToken(refreshToken),
              expiresAt,
              userAgent: req.headers["user-agent"] || null,
              ipAddress: getClientIp(req)
            });
            res.cookie("refresh_token", refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
              maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3,
              path: "/api/auth"
            });
            return res.status(200).json({
              success: true,
              user: sanitizeUser(user),
              token: accessToken,
              message: "Login successful"
            });
          }
          req.login(user, async (loginErr) => {
            if (loginErr) return next(loginErr);
            const response = {
              success: true,
              user: sanitizeUser(user),
              message: "Login successful"
            };
            if (AUTH_STRATEGY === "hybrid") {
              response.token = generateAccessToken(user);
              const refreshToken = generateRefreshToken();
              const expiresAt = new Date(
                Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3
              );
              await storage.createRefreshToken({
                userId: user.id,
                tokenHash: hashToken(refreshToken),
                expiresAt,
                userAgent: req.headers["user-agent"] || null,
                ipAddress: getClientIp(req)
              });
              res.cookie("refresh_token", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
                maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3,
                path: "/api/auth"
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
        message: "Internal server error"
      });
    }
  });
  app2.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "No refresh token provided"
        });
      }
      const tokenHash = hashToken(refreshToken);
      const storedToken = await storage.getRefreshTokenByHash(tokenHash);
      if (!storedToken || storedToken.revoked || /* @__PURE__ */ new Date() > storedToken.expiresAt) {
        if (storedToken?.revoked) {
          await storage.revokeAllUserRefreshTokens(storedToken.userId);
          auditLog("TOKEN_REUSE_DETECTED", {
            userId: storedToken.userId,
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
            reason: "Revoked refresh token was reused \u2014 all sessions invalidated"
          });
        } else {
          auditLog("TOKEN_REFRESH_FAILED", {
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
            reason: storedToken ? "Token expired" : "Token not found"
          });
        }
        res.clearCookie("refresh_token", { path: "/api/auth" });
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token"
        });
      }
      await storage.revokeRefreshToken(storedToken.id);
      const user = await storage.getUser(storedToken.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken();
      const expiresAt = new Date(
        Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3
      );
      await storage.createRefreshToken({
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt,
        userAgent: req.headers["user-agent"] || null,
        ipAddress: getClientIp(req)
      });
      res.cookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3,
        path: "/api/auth"
      });
      auditLog("TOKEN_REFRESH", {
        userId: user.id,
        email: user.email,
        ip: getClientIp(req)
      });
      res.json({
        success: true,
        token: newAccessToken,
        message: "Token refreshed successfully"
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });
  app2.post("/api/logout", async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const refreshToken = req.cookies?.refresh_token;
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const storedToken = await storage.getRefreshTokenByHash(tokenHash);
        if (storedToken) {
          await storage.revokeRefreshToken(storedToken.id);
        }
      }
      res.clearCookie("refresh_token", { path: "/api/auth" });
      auditLog("LOGOUT", {
        userId: userId ? String(userId) : void 0,
        ip: getClientIp(req)
      });
      if (AUTH_STRATEGY !== "jwt") {
        req.logout((err) => {
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
        message: "Internal server error"
      });
    }
  });
  app2.get("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.json({
        success: true,
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("User info error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });
  app2.get("/api/auth/health", (_req, res) => {
    res.json({
      success: true,
      strategy: AUTH_STRATEGY,
      environment: process.env.NODE_ENV,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
function sanitizeUser(user) {
  const { password, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

// server/subscription-service.ts
var SubscriptionService = class {
  static PLANS = {
    basic: {
      id: "basic",
      name: "Basic",
      price: 199900,
      // ₹1,999
      credits: 500,
      features: [
        "500 editing credits",
        "PDF export unlimited",
        "Public profile sharing",
        "Photo & CV upload"
      ],
      duration: 30
      // 30 days
    },
    premium: {
      id: "premium",
      name: "Premium",
      price: 299900,
      // ₹2,999
      credits: 1e3,
      features: [
        "1,000 editing credits",
        "PDF export unlimited",
        "Public profile sharing",
        "Photo & CV upload",
        "Priority support"
      ],
      duration: 30
      // 30 days
    }
  };
  /**
   * Get available subscription plans
   */
  static getPlans() {
    return Object.values(this.PLANS);
  }
  /**
   * Get a specific plan by ID
   */
  static getPlan(planId) {
    return this.PLANS[planId] || null;
  }
  /**
   * Create a new subscription for a user
   */
  static async createSubscription(userId, planType) {
    const plan = this.getPlan(planType.toLowerCase());
    if (!plan) {
      throw new Error(`Invalid plan type: ${planType}`);
    }
    const existingSubscription = await storage.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.active) {
      throw new Error("User already has an active subscription");
    }
    const endDate = /* @__PURE__ */ new Date();
    endDate.setDate(endDate.getDate() + plan.duration);
    const subscriptionData = {
      userId,
      planType: plan.name,
      creditsAllocated: plan.credits,
      creditsRemaining: plan.credits,
      active: true,
      endDate
    };
    return await storage.createSubscription(subscriptionData);
  }
  /**
   * Get subscription status for a user
   */
  static async getSubscriptionStatus(userId) {
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        planType: null,
        creditsRemaining: 0,
        creditsAllocated: 0,
        isExpired: false,
        daysUntilExpiry: null,
        canEdit: false
      };
    }
    const now = /* @__PURE__ */ new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const isExpired = endDate ? now > endDate : false;
    const daysUntilExpiry = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24)) : null;
    const hasActiveSubscription = Boolean(subscription.active) && !isExpired;
    const canEdit = hasActiveSubscription && (subscription.creditsRemaining ?? 0) >= 5;
    return {
      hasActiveSubscription,
      planType: subscription.planType,
      creditsRemaining: subscription.creditsRemaining ?? 0,
      creditsAllocated: subscription.creditsAllocated ?? 0,
      isExpired,
      daysUntilExpiry,
      canEdit
    };
  }
  /**
   * Check if user can perform an action that requires credits
   */
  static async canPerformAction(userId, creditsRequired = 5) {
    const status = await this.getSubscriptionStatus(userId);
    return status.canEdit && status.creditsRemaining >= creditsRequired;
  }
  /**
   * Deduct credits from user's subscription
   */
  static async deductCredits(userId, creditsToDeduct = 5) {
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription || !subscription.active) {
      throw new Error("No active subscription found");
    }
    if (subscription.creditsRemaining < creditsToDeduct) {
      throw new Error("Insufficient credits");
    }
    const updatedSubscription = await storage.updateSubscriptionCredits(
      userId,
      creditsToDeduct
    );
    return !!updatedSubscription;
  }
  /**
   * Add credits to user's subscription (for top-ups)
   */
  static async addCredits(userId, creditsToAdd) {
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription || !subscription.active) {
      throw new Error("No active subscription found");
    }
    await storage.addCreditsToSubscription(userId, creditsToAdd);
  }
  /**
   * Renew subscription
   */
  static async renewSubscription(userId, planType) {
    const plan = this.getPlan(planType.toLowerCase());
    if (!plan) {
      throw new Error(`Invalid plan type: ${planType}`);
    }
    const currentSubscription = await storage.getUserSubscription(userId);
    if (currentSubscription) {
    }
    return await this.createSubscription(userId, planType);
  }
  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId) {
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      throw new Error("No subscription found");
    }
    console.log(`Subscription cancelled for user: ${userId}`);
  }
  /**
   * Get subscription analytics for admin purposes
   */
  static async getSubscriptionAnalytics() {
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      totalCreditsAllocated: 0,
      totalCreditsRemaining: 0
    };
  }
  /**
   * Validate subscription before allowing access to protected features
   */
  static async validateAccess(userId, feature) {
    const status = await this.getSubscriptionStatus(userId);
    if (!status.hasActiveSubscription) {
      return {
        allowed: false,
        reason: "No active subscription"
      };
    }
    if (status.isExpired) {
      return {
        allowed: false,
        reason: "Subscription expired"
      };
    }
    if (status.creditsRemaining < 5) {
      return {
        allowed: false,
        reason: "Insufficient credits",
        creditsRemaining: status.creditsRemaining
      };
    }
    return {
      allowed: true,
      creditsRemaining: status.creditsRemaining
    };
  }
};

// server/s3-service.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
var s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});
var BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "canar-profile-builder";
var CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
var S3Service = class {
  /**
   * Upload a file to S3
   */
  static async uploadFile(file, folder = "uploads") {
    try {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(file.originalname);
      const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
      const key = `${folder}/${fileName}`;
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Remove ACL for buckets that don't support it
        // ACL: "public-read", // Make file publicly accessible
        Metadata: {
          originalName: file.originalname,
          uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      await s3Client.send(uploadCommand);
      const fileUrl = CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}/${key}` : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
      return {
        fileUrl,
        key,
        bucket: BUCKET_NAME
      };
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Delete a file from S3
   */
  static async deleteFile(key) {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      await s3Client.send(deleteCommand);
    } catch (error) {
      console.error("S3 delete error:", error);
      throw new Error(
        `Failed to delete file from S3: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Generate a presigned URL for direct upload (for client-side uploads)
   */
  static async generatePresignedUrl(fileName, contentType, folder = "uploads") {
    try {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(fileName);
      const key = `${folder}/${uniqueSuffix}${fileExtension}`;
      const putObjectCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        // Remove ACL for buckets that don't support it
        // ACL: "public-read",
        Metadata: {
          originalName: fileName,
          uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
        expiresIn: 3600
        // 1 hour
      });
      return { uploadUrl, key };
    } catch (error) {
      console.error("S3 presigned URL error:", error);
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Generate a presigned URL for file download (for private files)
   */
  static async generateDownloadUrl(key, expiresIn = 3600) {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      return await getSignedUrl(s3Client, getObjectCommand, { expiresIn });
    } catch (error) {
      console.error("S3 download URL error:", error);
      throw new Error(
        `Failed to generate download URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Extract S3 key from file URL
   */
  static extractKeyFromUrl(fileUrl) {
    try {
      if (CLOUDFRONT_DOMAIN && fileUrl.includes(CLOUDFRONT_DOMAIN)) {
        return fileUrl.replace(`https://${CLOUDFRONT_DOMAIN}/`, "");
      }
      const s3UrlPattern = new RegExp(
        `https://${BUCKET_NAME}\\.s3\\.[^.]+.amazonaws\\.com/(.+)`
      );
      const match = fileUrl.match(s3UrlPattern);
      return match ? match[1] : null;
    } catch (error) {
      console.error("Error extracting S3 key from URL:", error);
      return null;
    }
  }
  /**
   * Check if S3 is properly configured
   */
  static isConfigured() {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME);
  }
};

// server/routes.ts
import { z as z3 } from "zod";
import path2 from "path";
import { randomBytes as randomBytes2 } from "crypto";
import fs from "fs";
import multer from "multer";
function getUserId(req) {
  if (!req.user?.id) {
    throw new Error("Authentication required \u2014 no user on request");
  }
  return req.user.id;
}
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
function generateShareSlug() {
  return randomBytes2(8).toString("hex");
}
var upload = multer({
  storage: multer.memoryStorage(),
  // Store in memory for S3 upload
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "cv" && file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed for CV upload"));
      return;
    }
    if (file.fieldname === "photo" && !file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed for photo upload"));
      return;
    }
    cb(null, true);
  }
});
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/test", (req, res) => {
    res.sendFile(path2.join(process.cwd(), "test_form.html"));
  });
  app2.get("/input-test", (req, res) => {
    res.sendFile(path2.join(process.cwd(), "simple_input_test.html"));
  });
  app2.get("/debug-input", (req, res) => {
    res.sendFile(path2.join(process.cwd(), "debug_input_test.html"));
  });
  app2.get("/api/subscription/plans", requireAuth, (req, res) => {
    const plans = SubscriptionService.getPlans();
    res.json({
      success: true,
      plans
    });
  });
  app2.post(
    "/api/subscription/subscribe",
    requireAuth,
    requireTenantAccess,
    async (req, res) => {
      try {
        const { planType } = req.body;
        if (!planType) {
          return res.status(400).json({
            success: false,
            message: "Plan type is required"
          });
        }
        const userId = getUserId(req);
        const subscription = await SubscriptionService.createSubscription(
          userId,
          planType
        );
        res.json({
          success: true,
          subscription,
          message: `${subscription.planType} subscription created successfully`
        });
      } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({
          success: false,
          message: getErrorMessage(error) || "Error creating subscription"
        });
      }
    }
  );
  app2.post("/api/subscription/credits/topup", requireAuth, requireTenantAccess, async (req, res) => {
    try {
      const { credits, amount } = req.body;
      if (!credits || !amount) {
        return res.status(400).json({
          success: false,
          message: "Credits and amount are required"
        });
      }
      const userId = getUserId(req);
      let subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        subscription = await storage.createSubscription({
          userId,
          planType: "Premium",
          creditsAllocated: credits,
          creditsRemaining: credits,
          active: true,
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3)
          // 1 year from now
        });
      } else {
        await storage.addCreditsToSubscription(userId, credits);
      }
      await storage.createCreditPurchase({
        userId,
        credits,
        amount
      });
      res.json({
        success: true,
        message: "Credits added successfully",
        credits,
        newBalance: (subscription.creditsRemaining || 0) + credits
      });
    } catch (error) {
      console.error("Error adding credits:", error);
      res.status(500).json({
        success: false,
        message: "Error adding credits",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/credits", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      let subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        subscription = await storage.createSubscription({
          userId,
          planType: "Premium",
          creditsAllocated: 1e3,
          creditsRemaining: 1e3,
          active: true,
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3)
          // 1 year from now
        });
      }
      const status = await SubscriptionService.getSubscriptionStatus(userId);
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching credits",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/profile", requireAuth, async (req, res) => {
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
          experiences: []
        });
      }
      const [education3, projects3, skills3, experiences3] = await Promise.all([
        storage.getUserEducation(userId),
        storage.getUserProjects(userId),
        storage.getUserSkills(userId),
        storage.getUserExperiences(userId)
      ]);
      res.json({
        success: true,
        profile,
        education: education3,
        projects: projects3,
        skills: skills3,
        experiences: experiences3
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching profile",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to edit profile"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const profileData = {
        ...req.body,
        userId,
        shareSlug: req.body.shareSlug || generateShareSlug()
      };
      const validatedData = insertProfileSchema.parse(profileData);
      const profile = await storage.createOrUpdateProfile(validatedData);
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        profile,
        message: "Profile updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating profile",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/education", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const education3 = await storage.getUserEducation(userId);
      res.json({
        success: true,
        education: education3
      });
    } catch (error) {
      console.error("Error fetching education:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching education",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.post("/api/education", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add education"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const educationData = insertEducationSchema.parse({
        ...req.body,
        userId
      });
      const education3 = await storage.createEducation(educationData);
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        education: education3,
        message: "Education added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error creating education:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid education data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating education",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.put("/api/education/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update education"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const educationData = insertEducationSchema.partial().parse(req.body);
      const education3 = await storage.updateEducation(id, educationData);
      if (!education3) {
        return res.status(404).json({
          success: false,
          message: "Education record not found"
        });
      }
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        education: education3,
        message: "Education updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error updating education:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid education data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating education",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.delete("/api/education/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const ownerId = await storage.getEducationOwner(id);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Education record not found"
        });
      }
      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you do not own this resource"
        });
      }
      await storage.deleteEducation(id);
      res.json({
        success: true,
        message: "Education deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting education:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting education",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const projects3 = await storage.getUserProjects(userId);
      res.json({
        success: true,
        projects: projects3
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching projects",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add projects"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const projectData = insertProjectSchema.parse({ ...req.body, userId });
      const project = await storage.createProject(projectData);
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        project,
        message: "Project added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid project data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating project",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update projects"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, projectData);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        project,
        message: "Project updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error updating project:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid project data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating project",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const ownerId = await storage.getProjectOwner(id);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }
      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you do not own this resource"
        });
      }
      await storage.deleteProject(id);
      res.json({
        success: true,
        message: "Project deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting project",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/skills", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const skills3 = await storage.getUserSkills(userId);
      res.json({
        success: true,
        skills: skills3
      });
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching skills",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.post("/api/skills", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add skills"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const skillData = insertSkillSchema.parse({ ...req.body, userId });
      const skill = await storage.createSkill(skillData);
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        skill,
        message: "Skill added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error creating skill:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid skill data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating skill",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.put("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update skills"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const skillData = insertSkillSchema.partial().parse(req.body);
      const skill = await storage.updateSkill(id, skillData);
      if (!skill) {
        return res.status(404).json({
          success: false,
          message: "Skill not found"
        });
      }
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        skill,
        message: "Skill updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error updating skill:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid skill data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating skill",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.delete("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const ownerId = await storage.getSkillOwner(id);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Skill not found"
        });
      }
      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you do not own this resource"
        });
      }
      await storage.deleteSkill(id);
      res.json({
        success: true,
        message: "Skill deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting skill",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/experiences", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const experiences3 = await storage.getUserExperiences(userId);
      res.json({
        success: true,
        experiences: experiences3
      });
    } catch (error) {
      console.error("Error fetching experiences:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching experiences",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.post("/api/experiences", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to add experience"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const experienceData = insertExperienceSchema.parse({
        ...req.body,
        userId
      });
      const experience = await storage.createExperience(experienceData);
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        experience,
        message: "Experience added successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error creating experience:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error creating experience",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.put("/api/experiences/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to update experience"
        });
      }
      if (subscription.creditsRemaining < 5) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please top-up your credits to continue editing."
        });
      }
      const experienceData = insertExperienceSchema.partial().parse(req.body);
      const experience = await storage.updateExperience(id, experienceData);
      if (!experience) {
        return res.status(404).json({
          success: false,
          message: "Experience not found"
        });
      }
      const updatedSubscription = await storage.updateSubscriptionCredits(
        userId,
        5
      );
      if (!updatedSubscription) {
        return res.status(500).json({
          success: false,
          message: "Failed to deduct credits. Please try again."
        });
      }
      res.json({
        success: true,
        experience,
        message: "Experience updated successfully",
        creditsRemaining: updatedSubscription.creditsRemaining
      });
    } catch (error) {
      console.error("Error updating experience:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience data",
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: "Error updating experience",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.delete("/api/experiences/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const ownerId = await storage.getExperienceOwner(id);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Experience not found"
        });
      }
      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: you do not own this resource"
        });
      }
      await storage.deleteExperience(id);
      res.json({
        success: true,
        message: "Experience deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting experience:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting experience",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.get("/api/profile/share/:shareSlug", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const profile = await storage.getProfileByShareSlug(shareSlug);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Profile not found"
        });
      }
      const [education3, projects3, skills3, experiences3] = await Promise.all([
        storage.getUserEducation(profile.userId),
        storage.getUserProjects(profile.userId),
        storage.getUserSkills(profile.userId),
        storage.getUserExperiences(profile.userId)
      ]);
      res.json({
        success: true,
        profile,
        education: education3,
        projects: projects3,
        skills: skills3,
        experiences: experiences3
      });
    } catch (error) {
      console.error("Error fetching shared profile:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching profile",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.post(
    "/api/upload/cv",
    requireAuth,
    upload.single("cv"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded"
          });
        }
        const userId = getUserId(req);
        let fileUrl;
        if (S3Service.isConfigured()) {
          const uploadResult = await S3Service.uploadFile(req.file, "cv");
          fileUrl = uploadResult.fileUrl;
        } else {
          const uploadDir = path2.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileName = `cv-${uniqueSuffix}${path2.extname(
            req.file.originalname
          )}`;
          const filePath = path2.join(uploadDir, fileName);
          fs.writeFileSync(filePath, req.file.buffer);
          fileUrl = `/uploads/${fileName}`;
        }
        const profile = await storage.getUserProfile(userId);
        if (profile) {
          await storage.createOrUpdateProfile({
            ...profile,
            cvUrl: fileUrl
          });
        }
        res.json({
          success: true,
          fileUrl,
          message: "CV uploaded successfully"
        });
      } catch (error) {
        console.error("Error uploading CV:", error);
        res.status(500).json({
          success: false,
          message: "Error uploading CV",
          error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
        });
      }
    }
  );
  app2.post(
    "/api/upload/photo",
    requireAuth,
    upload.single("photo"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded"
          });
        }
        const userId = getUserId(req);
        let fileUrl;
        if (S3Service.isConfigured()) {
          const uploadResult = await S3Service.uploadFile(req.file, "photos");
          fileUrl = uploadResult.fileUrl;
        } else {
          const uploadDir = path2.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileName = `photo-${uniqueSuffix}${path2.extname(
            req.file.originalname
          )}`;
          const filePath = path2.join(uploadDir, fileName);
          fs.writeFileSync(filePath, req.file.buffer);
          fileUrl = `/uploads/${fileName}`;
        }
        const profile = await storage.getUserProfile(userId);
        if (profile) {
          await storage.createOrUpdateProfile({
            ...profile,
            photoUrl: fileUrl
          });
        }
        res.json({
          success: true,
          fileUrl,
          message: "Photo uploaded successfully"
        });
      } catch (error) {
        console.error("Error uploading photo:", error);
        res.status(500).json({
          success: false,
          message: "Error uploading photo",
          error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
        });
      }
    }
  );
  app2.post("/api/upload/presigned-url", requireAuth, async (req, res) => {
    try {
      const { fileName, contentType, folder } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({
          success: false,
          message: "fileName and contentType are required"
        });
      }
      if (!S3Service.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: "S3 is not configured"
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
        message: "Presigned URL generated successfully"
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({
        success: false,
        message: "Error generating presigned URL",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.delete("/api/upload/delete", requireAuth, async (req, res) => {
    try {
      const { fileUrl } = req.body;
      if (!fileUrl) {
        return res.status(400).json({
          success: false,
          message: "fileUrl is required"
        });
      }
      if (S3Service.isConfigured()) {
        const key = S3Service.extractKeyFromUrl(fileUrl);
        if (key) {
          await S3Service.deleteFile(key);
        }
      } else {
        const fileName = fileUrl.replace("/uploads/", "");
        const filePath = path2.join(process.cwd(), "uploads", fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      res.json({
        success: true,
        message: "File deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting file",
        error: process.env.NODE_ENV === "development" ? getErrorMessage(error) : void 0
      });
    }
  });
  app2.use("/uploads", express.static(path2.join(process.cwd(), "uploads")));
  app2.get("/api/candidates/stats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getCandidateStats(userId);
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error("Error fetching candidate stats:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching stats"
      });
    }
  });
  app2.post(
    "/api/candidates/parse-cv",
    requireAuth,
    upload.single("cv"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No CV file uploaded"
          });
        }
        const userId = getUserId(req);
        const subscription = await storage.getUserSubscription(userId);
        if (!subscription || !subscription.active) {
          return res.status(403).json({
            success: false,
            message: "Active subscription required to parse CVs"
          });
        }
        if (subscription.creditsRemaining < 10) {
          return res.status(403).json({
            success: false,
            message: "Insufficient credits. CV parsing requires 10 credits."
          });
        }
        const { extractTextFromPdf: extractTextFromPdf2 } = await Promise.resolve().then(() => (init_pdf_parser(), pdf_parser_exports));
        const { parseCvWithAI: parseCvWithAI2, buildSearchVector: buildSearchVector2 } = await Promise.resolve().then(() => (init_ai_service(), ai_service_exports));
        const pdfResult = await extractTextFromPdf2(req.file.buffer);
        const parsedData = await parseCvWithAI2(pdfResult.text);
        let cvUrl = null;
        if (S3Service.isConfigured()) {
          const uploadResult = await S3Service.uploadFile(req.file, "cv");
          cvUrl = uploadResult.fileUrl;
        } else {
          const uploadDir = path2.join(process.cwd(), "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileName = `cv-${uniqueSuffix}${path2.extname(
            req.file.originalname
          )}`;
          const filePath = path2.join(uploadDir, fileName);
          fs.writeFileSync(filePath, req.file.buffer);
          cvUrl = `/uploads/${fileName}`;
        }
        const candidate = await storage.createCandidate({
          userId,
          fullName: parsedData.fullName,
          email: parsedData.email,
          phone: parsedData.phone,
          location: parsedData.location,
          designation: parsedData.designation,
          summary: parsedData.summary,
          totalExperienceYears: parsedData.totalExperienceYears,
          skills: parsedData.skills.length > 0 ? parsedData.skills : null,
          technologies: parsedData.technologies.length > 0 ? parsedData.technologies : null,
          experience: parsedData.experience.length > 0 ? parsedData.experience : null,
          education: parsedData.education.length > 0 ? parsedData.education : null,
          projects: parsedData.projects.length > 0 ? parsedData.projects : null,
          certifications: parsedData.certifications.length > 0 ? parsedData.certifications : null,
          languages: parsedData.languages.length > 0 ? parsedData.languages : null,
          cvUrl,
          cvFileName: req.file.originalname,
          source: "cv_upload",
          rawParsedData: parsedData,
          searchVector: buildSearchVector2(parsedData)
        });
        const updatedSubscription = await storage.updateSubscriptionCredits(userId, 10);
        res.json({
          success: true,
          candidate,
          parsedData,
          message: "CV parsed and candidate saved successfully",
          creditsRemaining: updatedSubscription?.creditsRemaining
        });
      } catch (error) {
        console.error("Error parsing CV:", error);
        res.status(500).json({
          success: false,
          message: getErrorMessage(error) || "Error parsing CV"
        });
      }
    }
  );
  app2.post("/api/candidates/search", requireAuth, async (req, res) => {
    try {
      if (req.user.role !== "recruiter") {
        return res.status(403).json({
          success: false,
          message: "Only recruiters can perform AI candidate searches"
        });
      }
      const { query } = req.body;
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Search query is required"
        });
      }
      const userId = getUserId(req);
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription || !subscription.active) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to search candidates"
        });
      }
      if (subscription.creditsRemaining < 2) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. AI search requires 2 credits."
        });
      }
      const { extractSearchIntent: extractSearchIntent2 } = await Promise.resolve().then(() => (init_ai_service(), ai_service_exports));
      const searchIntent = await extractSearchIntent2(query.trim());
      const candidates2 = await storage.searchCandidates(userId, {
        skills: searchIntent.skills,
        technologies: searchIntent.technologies,
        minExperienceYears: searchIntent.minExperienceYears,
        maxExperienceYears: searchIntent.maxExperienceYears,
        location: searchIntent.location,
        designation: searchIntent.designation,
        keywords: searchIntent.keywords
      });
      const updatedSubscription = await storage.updateSubscriptionCredits(userId, 2);
      res.json({
        success: true,
        candidates: candidates2,
        searchIntent,
        total: candidates2.length,
        creditsRemaining: updatedSubscription?.creditsRemaining
      });
    } catch (error) {
      console.error("Error searching candidates:", error);
      res.status(500).json({
        success: false,
        message: getErrorMessage(error) || "Error searching candidates"
      });
    }
  });
  app2.post(
    "/api/candidates/import-excel",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No file uploaded"
          });
        }
        const userId = getUserId(req);
        const subscription = await storage.getUserSubscription(userId);
        if (!subscription || !subscription.active) {
          return res.status(403).json({
            success: false,
            message: "Active subscription required to import candidates"
          });
        }
        const { parseExcelBuffer: parseExcelBuffer2, excelRowToCandidateData: excelRowToCandidateData2 } = await Promise.resolve().then(() => (init_excel_import(), excel_import_exports));
        const { rows, errors } = parseExcelBuffer2(
          req.file.buffer,
          req.file.originalname
        );
        const creditsNeeded = rows.length;
        if (subscription.creditsRemaining < creditsNeeded) {
          return res.status(403).json({
            success: false,
            message: `Insufficient credits. Importing ${rows.length} candidates requires ${creditsNeeded} credits. You have ${subscription.creditsRemaining}.`
          });
        }
        const candidateDataList = rows.map(
          (row) => excelRowToCandidateData2(row, userId)
        );
        const imported = await storage.bulkCreateCandidates(
          candidateDataList
        );
        if (imported > 0) {
          await storage.updateSubscriptionCredits(userId, imported);
        }
        const updatedSubscription = await storage.getUserSubscription(userId);
        res.json({
          success: true,
          imported,
          errors,
          total: rows.length + errors.length,
          message: `Successfully imported ${imported} candidates`,
          creditsRemaining: updatedSubscription?.creditsRemaining
        });
      } catch (error) {
        console.error("Error importing Excel:", error);
        res.status(500).json({
          success: false,
          message: getErrorMessage(error) || "Error importing candidates"
        });
      }
    }
  );
  app2.get("/api/candidates", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;
      const candidates2 = await storage.getCandidatesByUser(
        userId,
        limit,
        offset
      );
      const total = await storage.getCandidateCount(userId);
      res.json({
        success: true,
        candidates: candidates2,
        total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching candidates:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching candidates"
      });
    }
  });
  app2.get("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const candidate = await storage.getCandidateById(
        req.params.id,
        userId
      );
      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found"
        });
      }
      res.json({
        success: true,
        candidate
      });
    } catch (error) {
      console.error("Error fetching candidate:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching candidate"
      });
    }
  });
  app2.delete("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const ownerId = await storage.getCandidateOwner(req.params.id);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found"
        });
      }
      if (ownerId.toString() !== userId.toString()) {
        console.error(`Delete candidate failed auth: ownerId (${ownerId}, ${typeof ownerId}) !== userId (${userId}, ${typeof userId})`);
        return res.status(403).json({
          success: false,
          message: "Access denied: you do not own this candidate"
        });
      }
      await storage.deleteCandidate(req.params.id);
      res.json({
        success: true,
        message: "Candidate deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting candidate:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting candidate"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/db-setup.ts
import { sql as sql3 } from "drizzle-orm";
import { scrypt as scrypt2, randomBytes as randomBytes3 } from "crypto";
import { promisify as promisify2 } from "util";
var scryptAsync2 = promisify2(scrypt2);
async function hashPassword2(password) {
  const salt = randomBytes3(16).toString("hex");
  const buf = await scryptAsync2(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function setupDatabase() {
  console.log("Setting up database...");
  try {
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      console.log("Creating database tables...");
      await createTables();
      console.log("Database tables created successfully");
    } else {
      console.log("Database tables already exist");
    }
    await runMigrations();
    await createIndexes();
    if (process.env.NODE_ENV !== "production") {
      await insertDefaultData();
    }
    console.log("Database setup completed successfully");
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}
async function checkTablesExist() {
  try {
    await db.execute(sql3`SELECT 1 FROM users LIMIT 1`);
    return true;
  } catch (error) {
    return false;
  }
}
async function createTables() {
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      username VARCHAR(100),
      last_login_at TIMESTAMP,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_type VARCHAR(20) NOT NULL,
      credits_allocated INTEGER NOT NULL,
      credits_remaining INTEGER NOT NULL,
      active BOOLEAN DEFAULT true,
      start_date TIMESTAMP DEFAULT NOW(),
      end_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS credit_purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credits INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      purchase_date TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      email VARCHAR(255),
      bio TEXT,
      photo_url TEXT,
      cv_url TEXT,
      share_slug VARCHAR(100) UNIQUE,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS education (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      degree VARCHAR(255),
      university VARCHAR(255),
      duration VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      description TEXT,
      link TEXT,
      duration VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100),
      proficiency VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS experiences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(255),
      company VARCHAR(255),
      duration VARCHAR(100),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql3`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked BOOLEAN DEFAULT false,
      user_agent TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
async function runMigrations() {
  console.log("Running column migrations...");
  const migrations = [
    // Users: security tracking fields
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;",
    // Refresh tokens: device fingerprinting
    "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT;",
    "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);"
  ];
  for (const migrationSql of migrations) {
    try {
      await db.execute(sql3.raw(migrationSql));
    } catch (error) {
      console.warn(`Migration skipped (may already exist): ${migrationSql}`);
    }
  }
  console.log("Column migrations completed");
}
async function createIndexes() {
  console.log("Creating database indexes...");
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_profiles_share_slug ON profiles(share_slug);",
    "CREATE INDEX IF NOT EXISTS idx_education_user_id ON education(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON experiences(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON credit_purchases(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);",
    // New: cleanup index for expired tokens
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_revoked ON refresh_tokens(expires_at, revoked);"
  ];
  for (const indexSql of indexes) {
    try {
      await db.execute(sql3.raw(indexSql));
    } catch (error) {
      console.warn(`Failed to create index: ${indexSql}`, error);
    }
  }
}
async function insertDefaultData() {
  console.log("Checking for default data...");
  try {
    const defaultUser = await db.select().from(users).where(sql3`email = 'bypass@canar.com'`).limit(1);
    if (defaultUser.length === 0) {
      console.log("Creating default dev user...");
      const hashedPassword = await hashPassword2("bypass-password");
      await db.insert(users).values({
        email: "bypass@canar.com",
        username: "bypass-user",
        password: hashedPassword
      });
      console.log("Default dev user created successfully");
    }
  } catch (error) {
    console.warn("Failed to insert default data:", error);
  }
}
async function validateDatabase() {
  console.log("Validating database connection and schema...");
  try {
    await db.execute(sql3`SELECT 1`);
    console.log("\u2713 Database connection successful");
    const requiredTables = [
      "users",
      "subscriptions",
      "profiles",
      "education",
      "projects",
      "skills",
      "experiences",
      "credit_purchases",
      "refresh_tokens"
    ];
    for (const table of requiredTables) {
      try {
        await db.execute(sql3.raw(`SELECT 1 FROM ${table} LIMIT 1`));
        console.log(`\u2713 Table '${table}' exists`);
      } catch (error) {
        console.log(`\u2717 Table '${table}' missing`);
        return false;
      }
    }
    console.log("\u2713 Database validation completed successfully");
    return true;
  } catch (error) {
    console.error("\u2717 Database validation failed:", error);
    return false;
  }
}

// server/security.ts
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { randomBytes as randomBytes4, createHmac } from "crypto";
var CSRF_SECRET = process.env.CSRF_SECRET || randomBytes4(32).toString("hex");
function generateCsrfToken() {
  const token = randomBytes4(32).toString("hex");
  const signature = createHmac("sha256", CSRF_SECRET).update(token).digest("hex");
  return `${token}.${signature}`;
}
function validateCsrfToken(fullToken) {
  const parts = fullToken.split(".");
  if (parts.length !== 2) return false;
  const [token, signature] = parts;
  const expected = createHmac("sha256", CSRF_SECRET).update(token).digest("hex");
  return signature === expected;
}
function setupSecurity(app2) {
  const isProduction = process.env.NODE_ENV === "production";
  app2.use(
    helmet({
      contentSecurityPolicy: isProduction ? void 0 : false,
      // Disable CSP in dev (Vite injects inline scripts)
      crossOriginEmbedderPolicy: false
      // May interfere with image loading
    })
  );
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((o) => o.trim());
  app2.use(
    cors({
      origin: isProduction ? allowedOrigins : true,
      // Allow all origins in development
      credentials: true,
      // Required for cookies (session, refresh token)
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token"
      ],
      maxAge: 86400
      // 24 hours
    })
  );
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "200", 10),
    standardHeaders: true,
    // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later."
    },
    skip: (req) => {
      return req.path === "/api/auth/health";
    }
  });
  app2.use("/api", globalLimiter);
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "900000", 10),
    // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many authentication attempts, please try again later."
    },
    keyGenerator: (req) => {
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const username = req.body?.username || req.body?.email || "";
      return `${ip}:${username}`;
    }
  });
  app2.use("/api/login", authLimiter);
  app2.use("/api/register", authLimiter);
  app2.use("/api/auth/refresh", authLimiter);
  app2.get("/api/auth/csrf-token", (_req, res) => {
    const token = generateCsrfToken();
    res.cookie("csrf_token", token, {
      httpOnly: false,
      // Must be readable by JavaScript
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    });
    res.json({ success: true, csrfToken: token });
  });
  app2.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }
    const skipPaths = [
      "/api/login",
      "/api/register",
      "/api/auth/refresh",
      "/api/auth/csrf-token",
      "/api/auth/health"
    ];
    if (skipPaths.some((p) => req.path === p)) {
      return next();
    }
    if (!isProduction) {
      return next();
    }
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies?.csrf_token;
    const token = headerToken || cookieToken;
    if (!token || !validateCsrfToken(token)) {
      return res.status(403).json({
        success: false,
        message: "Invalid or missing CSRF token"
      });
    }
    next();
  });
}

// api/index.ts
import cookieParser from "cookie-parser";
var app = express2();
app.use(express2.json({ limit: "1mb" }));
app.use(express2.urlencoded({ extended: false }));
app.use(cookieParser());
setupSecurity(app);
var dbInitialized = false;
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
var routesRegistered = false;
async function ensureRoutes() {
  if (!routesRegistered) {
    await ensureDb();
    await registerRoutes(app);
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
    routesRegistered = true;
  }
}
async function handler(req, res) {
  await ensureRoutes();
  return app(req, res);
}
export {
  handler as default
};

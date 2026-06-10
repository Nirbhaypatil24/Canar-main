import Groq from "groq-sdk";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const nullToEmpty = (val: unknown) => (val === null || val === undefined ? "" : val);
const nullToEmptyArray = (val: unknown) => (val === null || val === undefined ? [] : val);

const ExperienceItemSchema = z.object({
  role: z.preprocess(nullToEmpty, z.string().default("")),
  company: z.preprocess(nullToEmpty, z.string().default("")),
  duration: z.preprocess(nullToEmpty, z.string().default("")),
  description: z.preprocess(nullToEmpty, z.string().default("")),
});

const EducationItemSchema = z.object({
  degree: z.preprocess(nullToEmpty, z.string().default("")),
  institution: z.preprocess(nullToEmpty, z.string().default("")),
  year: z.preprocess(nullToEmpty, z.string().default("")),
});

const ProjectItemSchema = z.object({
  name: z.preprocess(nullToEmpty, z.string().default("")),
  description: z.preprocess(nullToEmpty, z.string().default("")),
  technologies: z.preprocess(nullToEmptyArray, z.array(z.string()).default([])),
});

export const ParsedCandidateSchema = z.object({
  fullName: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  designation: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  totalExperienceYears: z.number().int().nullable().default(null),
  skills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  experience: z.array(ExperienceItemSchema).default([]),
  education: z.array(EducationItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});

export type ParsedCandidateData = z.infer<typeof ParsedCandidateSchema>;

const SearchIntentSchema = z.object({
  skills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  minExperienceYears: z.number().nullable().default(null),
  maxExperienceYears: z.number().nullable().default(null),
  location: z.string().nullable().default(null),
  designation: z.string().nullable().default(null),
  keywords: z.array(z.string()).default([]),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

// ─── AI Client ────────────────────────────────────────────────────────────────

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Please add it to your .env file to enable AI features."
    );
  }
  return new Groq({ apiKey });
}

// Use llama-3.3-70b-versatile for best JSON extraction quality
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ─── CV Parsing ───────────────────────────────────────────────────────────────

const CV_PARSE_PROMPT = `You are an expert resume/CV parser. Analyze the following resume text and extract structured information.

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

/**
 * Parse CV text using Groq AI to extract structured candidate data.
 * Includes retry logic and response validation.
 */
export async function parseCvWithAI(
  cvText: string
): Promise<ParsedCandidateData> {
  const groq = getGroqClient();

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Truncate extremely long CVs to avoid token limits
      const truncatedText =
        cvText.length > 15000 ? cvText.slice(0, 15000) + "\n...[truncated]" : cvText;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: CV_PARSE_PROMPT + truncatedText,
          },
        ],
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      let text = chatCompletion.choices[0]?.message?.content?.trim() || "";

      // Strip markdown code blocks if present
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(text);
      const validated = ParsedCandidateSchema.parse(parsed);
      return validated;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message || "";
      console.error(
        `AI CV parsing attempt ${attempt + 1} failed:`,
        msg
      );

      // Don't retry on non-retryable errors
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
        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  throw new Error(
    `Failed to parse CV after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`
  );
}

// ─── Search Intent Extraction ─────────────────────────────────────────────────

const SEARCH_INTENT_PROMPT = `You are an expert at understanding recruiter search queries. Analyze the following natural language search query and extract the search intent.

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

/**
 * Extract structured search intent from a natural language query using Groq AI.
 */
export async function extractSearchIntent(
  query: string
): Promise<SearchIntent> {
  const groq = getGroqClient();

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: SEARCH_INTENT_PROMPT + query,
        },
      ],
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    let text = chatCompletion.choices[0]?.message?.content?.trim() || "";

    // Strip markdown code blocks if present
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text);
    return SearchIntentSchema.parse(parsed);
  } catch (error: unknown) {
    console.error("Failed to extract search intent:", error);
    // Fallback: treat entire query as keywords
    return {
      skills: [],
      technologies: [],
      minExperienceYears: null,
      maxExperienceYears: null,
      location: null,
      designation: null,
      keywords: query.split(/\s+/).filter((w) => w.length > 2),
    };
  }
}

// ─── Search Vector Builder ────────────────────────────────────────────────────

/**
 * Build a search vector string from candidate data for text search.
 * Concatenates all relevant fields into a single lowercase string.
 */
export function buildSearchVector(data: ParsedCandidateData): string {
  const parts: string[] = [];

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

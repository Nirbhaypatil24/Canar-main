import * as XLSX from "xlsx";

export interface ExcelImportRow {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  designation?: string;
  summary?: string;
  totalExperienceYears?: number;
  skills?: string;       // Comma-separated
  technologies?: string; // Comma-separated
  certifications?: string; // Comma-separated
  languages?: string;    // Comma-separated
  company?: string;
  currentRole?: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
  total: number;
}

// Flexible column name mapping — maps various common column headers to our field names
const COLUMN_MAP: Record<string, keyof ExcelImportRow> = {
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
  "employer": "company",
};

/**
 * Parse an Excel/CSV buffer and extract candidate rows.
 */
export function parseExcelBuffer(buffer: Buffer, fileName: string): {
  rows: ExcelImportRow[];
  errors: ImportError[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded file contains no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  if (rawRows.length === 0) {
    throw new Error("The uploaded file contains no data rows.");
  }

  // Map column headers to our field names
  const firstRow = rawRows[0];
  const headerMap: Record<string, keyof ExcelImportRow> = {};

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

  const rows: ExcelImportRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row: ExcelImportRow = {};

    try {
      for (const [originalHeader, fieldName] of Object.entries(headerMap)) {
        const value = raw[originalHeader];
        if (value !== undefined && value !== null && value !== "") {
          if (fieldName === "totalExperienceYears") {
            const num = parseInt(String(value), 10);
            row[fieldName] = isNaN(num) ? undefined : num;
          } else {
            (row as any)[fieldName] = String(value).trim();
          }
        }
      }

      // Require at least a name or email
      if (!row.fullName && !row.email) {
        errors.push({
          row: i + 2, // +2 for header row + 1-based index
          message: "Row must have at least a name or email.",
        });
        continue;
      }

      rows.push(row);
    } catch (error: unknown) {
      errors.push({
        row: i + 2,
        message:
          error instanceof Error ? error.message : "Unknown error parsing row",
      });
    }
  }

  return { rows, errors };
}

/**
 * Convert a parsed Excel row into candidate data fields suitable for DB insertion.
 */
export function excelRowToCandidateData(
  row: ExcelImportRow,
  userId: string
): Record<string, any> {
  const splitCsv = (value?: string): string[] => {
    if (!value) return [];
    return value
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const skills = splitCsv(row.skills);
  const technologies = splitCsv(row.technologies);
  const certifications = splitCsv(row.certifications);
  const languages = splitCsv(row.languages);

  // Build experience array from company/role if provided
  const experience: { role: string; company: string; duration: string; description: string }[] = [];
  if (row.company || row.currentRole) {
    experience.push({
      role: row.currentRole || row.designation || "",
      company: row.company || "",
      duration: row.totalExperienceYears
        ? `${row.totalExperienceYears} years`
        : "",
      description: "",
    });
  }

  // Build search vector
  const searchParts = [
    row.fullName,
    row.designation,
    row.location,
    row.summary,
    ...skills,
    ...technologies,
    ...certifications,
    ...languages,
    row.company,
    row.currentRole,
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
    skills: skills.length > 0 ? skills : null,
    technologies: technologies.length > 0 ? technologies : null,
    experience: experience.length > 0 ? experience : null,
    education: null,
    projects: null,
    certifications: certifications.length > 0 ? certifications : null,
    languages: languages.length > 0 ? languages : null,
    source: "excel_import",
    searchVector: searchParts.join(" ").toLowerCase(),
  };
}

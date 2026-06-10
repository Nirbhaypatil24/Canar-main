import { createRequire } from "module";

// pdf-parse v1 is CJS-only and its index.js has a bug where it tries
// to read a test PDF when loaded via ESM dynamic import().
// We use createRequire to load the internal parser directly.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse");

export interface PdfParseResult {
  text: string;
  numPages: number;
  info: Record<string, any>;
}

/**
 * Extract text content from a PDF buffer.
 * Returns cleaned text suitable for AI parsing.
 */
export async function extractTextFromPdf(
  buffer: Buffer
): Promise<PdfParseResult> {
  try {
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        "No text could be extracted from this PDF. It may be an image-only or scanned document."
      );
    }

    // Clean the extracted text
    const cleanedText = data.text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
      .replace(/[ \t]{2,}/g, " ") // Collapse excessive spaces
      .trim();

    return {
      text: cleanedText,
      numPages: data.numpages,
      info: data.info || {},
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Check for common PDF errors
      if (
        error.message.includes("password") ||
        error.message.includes("encrypted")
      ) {
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

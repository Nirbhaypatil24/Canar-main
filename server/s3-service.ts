import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import path from "path";

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "canar-profile-builder";
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN; // Optional: for CDN

export interface UploadResult {
  fileUrl: string;
  key: string;
  bucket: string;
}

export class S3Service {
  /**
   * Upload a file to S3
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = "uploads"
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(file.originalname);
      const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
      const key = `${folder}/${fileName}`;

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Remove ACL for buckets that don't support it
        // ACL: "public-read", // Make file publicly accessible
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(uploadCommand);

      // Generate file URL
      const fileUrl = CLOUDFRONT_DOMAIN
        ? `https://${CLOUDFRONT_DOMAIN}/${key}`
        : `https://${BUCKET_NAME}.s3.${
            process.env.AWS_REGION || "us-east-1"
          }.amazonaws.com/${key}`;

      return {
        fileUrl,
        key,
        bucket: BUCKET_NAME,
      };
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error(
        `Failed to upload file to S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(deleteCommand);
    } catch (error) {
      console.error("S3 delete error:", error);
      throw new Error(
        `Failed to delete file from S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate a presigned URL for direct upload (for client-side uploads)
   */
  static async generatePresignedUrl(
    fileName: string,
    contentType: string,
    folder: string = "uploads"
  ): Promise<{ uploadUrl: string; key: string }> {
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
          uploadedAt: new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
        expiresIn: 3600, // 1 hour
      });

      return { uploadUrl, key };
    } catch (error) {
      console.error("S3 presigned URL error:", error);
      throw new Error(
        `Failed to generate presigned URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate a presigned URL for file download (for private files)
   */
  static async generateDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      return await getSignedUrl(s3Client, getObjectCommand, { expiresIn });
    } catch (error) {
      console.error("S3 download URL error:", error);
      throw new Error(
        `Failed to generate download URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract S3 key from file URL
   */
  static extractKeyFromUrl(fileUrl: string): string | null {
    try {
      if (CLOUDFRONT_DOMAIN && fileUrl.includes(CLOUDFRONT_DOMAIN)) {
        return fileUrl.replace(`https://${CLOUDFRONT_DOMAIN}/`, "");
      }

      const s3UrlPattern = new RegExp(
        `https://${BUCKET_NAME}\\.s3\\.[^.]+\.amazonaws\\.com/(.+)`
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
  static isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET_NAME
    );
  }
}

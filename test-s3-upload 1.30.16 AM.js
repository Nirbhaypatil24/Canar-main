#!/usr/bin/env node

/**
 * Test script for S3 upload functionality
 * Run with: node test-s3-upload.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test S3 configuration
function testS3Configuration() {
  console.log("🔍 Testing S3 Configuration...");

  const requiredEnvVars = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET_NAME",
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.log("❌ Missing environment variables:", missing.join(", "));
    console.log("💡 Set these variables in your .env file or environment");
    return false;
  }

  console.log("✅ S3 configuration looks good");
  console.log(`   Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
  console.log(`   Region: ${process.env.AWS_REGION || "us-east-1"}`);

  if (process.env.CLOUDFRONT_DOMAIN) {
    console.log(`   CDN: ${process.env.CLOUDFRONT_DOMAIN}`);
  }

  return true;
}

// Test S3 service import
async function testS3Service() {
  console.log("\n🔍 Testing S3 Service Import...");

  try {
    const { S3Service } = await import("./server/s3-service.ts");
    console.log("✅ S3Service imported successfully");

    const isConfigured = S3Service.isConfigured();
    console.log(`   S3 Configured: ${isConfigured ? "Yes" : "No"}`);

    return true;
  } catch (error) {
    console.log("❌ Failed to import S3Service:", error.message);
    return false;
  }
}

// Test file upload simulation
async function testFileUpload() {
  console.log("\n🔍 Testing File Upload Simulation...");

  try {
    // Create a test file
    const testContent = "This is a test file for S3 upload";
    const testFilePath = path.join(__dirname, "test-file.txt");

    fs.writeFileSync(testFilePath, testContent);

    // Simulate multer file object
    const mockFile = {
      fieldname: "test",
      originalname: "test-file.txt",
      mimetype: "text/plain",
      buffer: fs.readFileSync(testFilePath),
      size: testContent.length,
    };

    const { S3Service } = await import("./server/s3-service.ts");

    if (!S3Service.isConfigured()) {
      console.log("⚠️  S3 not configured, skipping upload test");
      fs.unlinkSync(testFilePath);
      return true;
    }

    console.log("📤 Attempting S3 upload...");
    const result = await S3Service.uploadFile(mockFile, "test");

    console.log("✅ File uploaded successfully");
    console.log(`   URL: ${result.fileUrl}`);
    console.log(`   Key: ${result.key}`);
    console.log(`   Bucket: ${result.bucket}`);

    // Clean up test file
    fs.unlinkSync(testFilePath);

    return true;
  } catch (error) {
    console.log("❌ File upload test failed:", error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log("🚀 Starting S3 Integration Tests\n");

  const tests = [testS3Configuration, testS3Service, testFileUpload];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) passed++;
    } catch (error) {
      console.log(`❌ Test failed with error: ${error.message}`);
    }
  }

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! S3 integration is working correctly.");
  } else {
    console.log(
      "⚠️  Some tests failed. Check the configuration and try again."
    );
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

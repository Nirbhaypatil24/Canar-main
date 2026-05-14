# File Upload Implementation

This document describes the file upload functionality that has been implemented for the Canar SPA Profile Builder.

## Overview

The file upload system allows users to upload CV (PDF) and profile photos (images) to the server. Files are stored locally in an `uploads/` directory and served statically.

## Features

- **CV Upload**: Accepts PDF files only, max 10MB
- **Photo Upload**: Accepts image files only, max 10MB
- **Drag & Drop**: Users can drag files onto upload areas
- **File Validation**: Client and server-side validation
- **Progress Feedback**: Loading states and error handling
- **Permanent Storage**: Files are stored on the server, not just in browser memory

## Implementation Details

### Server-Side

#### Dependencies

- `multer`: File upload middleware
- `@types/multer`: TypeScript types for multer

#### Upload Configuration

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
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
```

#### API Endpoints

**CV Upload**

- `POST /api/upload/cv`
- Requires authentication
- Accepts multipart form data with field name "cv"
- Returns: `{ success: true, fileUrl: string, message: string }`
- Uploads to S3 if configured, otherwise local storage

**Photo Upload**

- `POST /api/upload/photo`
- Requires authentication
- Accepts multipart form data with field name "photo"
- Returns: `{ success: true, fileUrl: string, message: string }`
- Uploads to S3 if configured, otherwise local storage

**Presigned URL Generation**

- `POST /api/upload/presigned-url`
- Requires authentication
- Body: `{ fileName: string, contentType: string, folder?: string }`
- Returns: `{ success: true, uploadUrl: string, key: string, message: string }`
- Generates temporary upload URL for direct S3 upload

**File Deletion**

- `DELETE /api/upload/delete`
- Requires authentication
- Body: `{ fileUrl: string }`
- Returns: `{ success: true, message: string }`
- Deletes file from S3 or local storage

**File Serving**

- `GET /uploads/*` - Serves uploaded files statically (local storage only)

### Client-Side

#### FileUpload Component

A reusable component that handles:

- File selection via click or drag & drop
- File type and size validation
- Upload progress indication
- Error handling and display
- Current file display

#### Usage Example

```tsx
<FileUpload type="cv" onUpload={handleCVUpload} currentFile={profile?.cvUrl} />
```

#### Upload Handlers

```typescript
const handleCVUpload = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("cv", file);

    const response = await fetch("/api/upload/cv", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Upload failed");
    }

    const result = await response.json();
    updateProfileMutation.mutate({ cvUrl: result.fileUrl });

    toast({
      title: "CV Uploaded",
      description: "Your CV has been uploaded successfully!",
    });
  } catch (error) {
    toast({
      title: "Upload Failed",
      description:
        error instanceof Error ? error.message : "Failed to upload CV",
      variant: "destructive",
    });
  }
};
```

## File Storage

### Local Storage (Fallback)

#### Directory Structure

```
uploads/
├── cv-1234567890-123456789.pdf
├── photo-1234567890-987654321.jpg
└── ...
```

#### File Naming Convention

- `{fieldname}-{timestamp}-{random}.{extension}`
- Example: `cv-1703123456789-123456789.pdf`

#### Database Storage

Files are referenced in the database by their URL path:

- `cvUrl`: `/uploads/cv-1234567890-123456789.pdf`
- `photoUrl`: `/uploads/photo-1234567890-987654321.jpg`

### AWS S3 Storage (Production)

#### S3 Bucket Structure

```
your-bucket-name/
├── cv/
│   ├── cv-1234567890-123456789.pdf
│   └── ...
├── photos/
│   ├── photo-1234567890-987654321.jpg
│   └── ...
└── uploads/
    └── ...
```

#### File URLs

- **S3 Direct**: `https://bucket-name.s3.region.amazonaws.com/cv/filename.pdf`
- **CloudFront CDN**: `https://your-cdn.cloudfront.net/cv/filename.pdf`

#### Configuration

Set the following environment variables:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
CLOUDFRONT_DOMAIN=your-cdn-domain.cloudfront.net  # Optional
```

See `S3_CONFIGURATION.md` for detailed setup instructions.

## Security Considerations

1. **File Type Validation**: Both client and server validate file types
2. **File Size Limits**: 10MB maximum file size
3. **Authentication Required**: All upload endpoints require authentication
4. **Unique Filenames**: Prevents filename conflicts and path traversal
5. **Static File Serving**: Files are served from a dedicated directory

## Testing

A test page is available at `/test-upload` to verify upload functionality:

- Test CV upload with PDF files
- Test photo upload with image files
- View upload results and error messages

## Future Improvements

1. ✅ **Cloud Storage**: AWS S3 integration implemented
2. **Image Processing**: Add image resizing and optimization
3. ✅ **File Cleanup**: Implement automatic cleanup of unused files
4. ✅ **CDN Integration**: CloudFront support for faster file delivery
5. **Virus Scanning**: Add malware scanning for uploaded files

## Migration from Previous Implementation

The previous implementation used `URL.createObjectURL()` which created temporary blob URLs that were not persistent. The new implementation:

1. Actually uploads files to the server
2. Stores permanent URLs in the database
3. Provides proper file persistence across sessions
4. Enables file sharing and access from different devices

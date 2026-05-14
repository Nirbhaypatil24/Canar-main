# S3 Configuration Guide

This guide explains how to configure AWS S3 for file uploads in the Canar Profile Builder application.

## Required Environment Variables

Add the following environment variables to your `.env` file:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=canar-profile-builder

# Optional: CloudFront CDN domain for faster file delivery
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

## AWS S3 Setup

### 1. Create an S3 Bucket

1. Go to AWS S3 Console
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `canar-profile-builder`)
4. Select your preferred region
5. Configure bucket settings:
   - **Block Public Access**: Uncheck "Block all public access" (since we need public read access)
   - **Bucket Versioning**: Optional
   - **Default Encryption**: Enable server-side encryption
6. Click "Create bucket"

### 2. Configure Bucket Policy

Add the following bucket policy to allow public read access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 3. Configure Object Ownership

Since newer S3 buckets disable ACLs by default, you need to configure Object Ownership:

1. Go to your S3 bucket → **Permissions** tab
2. Scroll down to **Object Ownership**
3. Click **Edit**
4. Choose **ACLs disabled (recommended)**
5. Check **Acknowledge that ACLs will be disabled**
6. Click **Save changes**

This setting allows the bucket policy to control public access instead of individual object ACLs.

### 4. Create IAM User

1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach the following policy (or create a custom one):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

4. Save the Access Key ID and Secret Access Key

## Optional: CloudFront CDN Setup

For better performance, you can set up CloudFront:

1. Create a CloudFront distribution
2. Set the S3 bucket as the origin
3. Configure caching behavior
4. Add the CloudFront domain to your environment variables

## File Structure in S3

Files will be organized in the following structure:

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

## Features

### Automatic Fallback

- If S3 is not configured, the application will fall back to local file storage
- No code changes required to switch between S3 and local storage

### File Management

- **Upload**: Files are uploaded directly to S3 with public read access
- **Delete**: Files can be deleted from S3 when no longer needed
- **Presigned URLs**: Generate temporary upload URLs for client-side uploads

### Security

- Files are stored with public read access (for profile sharing)
- Upload requires authentication
- File type validation (PDF for CV, images for photos)
- File size limits (10MB)

## Testing

To test S3 uploads:

1. Set up your environment variables
2. Start the application
3. Try uploading a CV or photo
4. Check the S3 bucket to verify the file was uploaded
5. Verify the file URL is accessible

## Troubleshooting

### Common Issues

1. **Access Denied**: Check IAM permissions and bucket policy
2. **Bucket Not Found**: Verify bucket name and region
3. **Invalid Credentials**: Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
4. **CORS Issues**: Configure CORS policy if uploading from browser
5. **ACL Not Supported**: Ensure Object Ownership is set to "ACLs disabled"

### ACL Error Fix

If you see `AccessControlListNotSupported: The bucket does not allow ACLs`:

1. **Check Object Ownership**: Go to S3 bucket → Permissions → Object Ownership
2. **Disable ACLs**: Set to "ACLs disabled (recommended)"
3. **Use Bucket Policy**: Ensure bucket policy allows public read access
4. **Remove ACL from Code**: The code has been updated to not use ACLs

### CORS Configuration (if needed)

If you encounter CORS issues, add this CORS configuration to your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## Migration from Local Storage

If you're migrating from local storage to S3:

1. Set up S3 configuration
2. Restart the application
3. New uploads will go to S3
4. Old local files will continue to work
5. Consider migrating existing files to S3 if needed

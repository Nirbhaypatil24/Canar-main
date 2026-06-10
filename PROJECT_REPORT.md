# Canar — SPA Profile Builder
## Full Project Report

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement & Objectives](#2-problem-statement--objectives)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Database Design](#5-database-design)
6. [Module Breakdown](#6-module-breakdown)
   - 6.1 [Authentication Module](#61-authentication-module)
   - 6.2 [Security Module](#62-security-module)
   - 6.3 [Subscription & Credit Module](#63-subscription--credit-module)
   - 6.4 [Profile Management Module](#64-profile-management-module)
   - 6.5 [File Upload Module (S3)](#65-file-upload-module-s3)
   - 6.6 [PDF Export Module](#66-pdf-export-module)
   - 6.7 [Client-Side Module](#67-client-side-module)
7. [Authentication — Deep Dive](#7-authentication--deep-dive)
8. [API Reference](#8-api-reference)
9. [Security Implementation](#9-security-implementation)
10. [Testing & Validation](#10-testing--validation)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Codebase Statistics](#12-codebase-statistics)
13. [Future Scope](#13-future-scope)
14. [Conclusion](#14-conclusion)

---

## 1. Project Overview

**Canar** is a full-stack, service-oriented **SaaS web application** for building, managing, and sharing professional profiles. It allows users to register, subscribe to a credit-based plan, and then build rich profiles comprising education, work experience, projects, and skills — all exportable as a PDF and shareable via a public link.

The application follows a **multi-tenant architecture** where each user's data is completely isolated, and a **credit-based access control** model where profile editing operations consume credits from the user's active subscription.

| Attribute          | Value                                           |
|--------------------|--------------------------------------------------|
| **Project Name**   | Canar — SPA Profile Builder                      |
| **Type**           | Multi-Tenant SaaS Web Application                |
| **Architecture**   | Service-Oriented, REST API + SPA                 |
| **Frontend**       | React 18 (TypeScript) + Vite                     |
| **Backend**        | Express.js (TypeScript) + Node.js                |
| **Database**       | PostgreSQL (via Drizzle ORM)                      |
| **Auth Strategy**  | Hybrid (JWT + Session) — configurable             |
| **File Storage**   | AWS S3 (with presigned URL support)               |
| **License**        | MIT                                              |

---

## 2. Problem Statement & Objectives

### Problem Statement

Professionals and job seekers need a centralized, easy-to-use tool to build, maintain, and share structured profiles. Existing solutions are either too complex (full resume builders with templates), lack programmatic access, or don't support real-time collaborative features. There is a need for a **lightweight, secure, SaaS-ready profile builder** that can scale to support multiple tenants with proper data isolation.

### Objectives

1. **Build a production-grade authentication system** supporting multiple strategies (JWT, session-based, hybrid) with secure password hashing, token rotation, and account lockout.
2. **Implement multi-tenant data isolation** ensuring no user can access another user's data at both the API middleware and database constraint level.
3. **Create a credit-based subscription model** where profile edits consume credits, with plan management, top-ups, and expiration handling.
4. **Develop a responsive SPA** with protected routes, real-time subscription status, and intuitive profile-building UI.
5. **Design for cloud deployment** with S3 file storage, containerization support, and environment-driven configuration.

---

## 3. Technology Stack

### Backend

| Technology         | Purpose                                 | Version     |
|--------------------|------------------------------------------|-------------|
| Node.js            | Runtime environment                      | 20.x        |
| Express.js         | HTTP server and REST API framework       | 4.21.x      |
| TypeScript         | Type-safe language                       | 5.6.3       |
| Drizzle ORM        | Database ORM and query builder           | 0.39.x      |
| PostgreSQL         | Relational database                      | 12+         |
| Passport.js        | Authentication middleware                | 0.7.x       |
| JSON Web Token     | Stateless token authentication           | 9.0.x       |
| Helmet             | HTTP security headers                    | 8.2.x       |
| express-rate-limit | API rate limiting                        | 8.5.x       |
| Zod                | Runtime input validation                 | 3.24.x      |
| AWS SDK (S3)       | File storage                             | 3.864.x     |
| Multer             | Multipart file upload handling           | 2.0.x       |

### Frontend

| Technology            | Purpose                              | Version     |
|------------------------|--------------------------------------|-------------|
| React                  | UI framework                         | 18.3.x      |
| Vite                   | Build tool and dev server            | 7.1.x       |
| Wouter                 | Client-side routing                  | 3.3.x       |
| TanStack React Query   | Server state management              | 5.60.x      |
| Tailwind CSS           | Utility-first CSS                    | 3.4.x       |
| Radix UI               | Accessible component primitives      | Various     |
| Framer Motion          | Animations                           | 11.13.x     |
| Lucide React           | Icon library                         | 0.453.x     |
| jsPDF                  | Client-side PDF generation           | 3.0.x       |
| React Hook Form        | Form state management                | 7.55.x      |

### Infrastructure & Tooling

| Technology        | Purpose                                  |
|--------------------|------------------------------------------|
| nodemon            | Development auto-restart                 |
| tsx                | TypeScript execution (dev)               |
| esbuild            | Server bundling (production)             |
| drizzle-kit        | Database migration tooling               |
| PostCSS            | CSS processing                           |

---

## 4. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   React 18 SPA (TypeScript)                                     │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐            │
│   │  Wouter   │  │  React Query │  │  Auth Context │            │
│   │  Router   │  │  (Cache)     │  │  (JWT Mgmt)   │            │
│   └──────────┘  └──────────────┘  └───────────────┘            │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐            │
│   │ Radix UI │  │  Tailwind    │  │  Framer Motion│            │
│   │ (Comps)  │  │  CSS         │  │  (Animation)  │            │
│   └──────────┘  └──────────────┘  └───────────────┘            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (REST API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
│                                                                 │
│   Express.js Server                                             │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────┐            │
│   │  Helmet  │  │  CORS        │  │  Rate Limiter │            │
│   │ (Headers)│  │  Middleware   │  │ (Global+Auth) │            │
│   └──────────┘  └──────────────┘  └───────────────┘            │
│   ┌──────────┐  ┌──────────────┐                                │
│   │  CSRF    │  │  Cookie      │                                │
│   │  Guard   │  │  Parser      │                                │
│   └──────────┘  └──────────────┘                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│                                                                 │
│   ┌─────────────┐  ┌────────────────┐  ┌───────────────┐       │
│   │  Auth       │  │  Subscription  │  │  Profile      │       │
│   │  Service    │  │  Service       │  │  Service      │       │
│   │             │  │                │  │               │       │
│   │ • Register  │  │ • Plan Mgmt   │  │ • CRUD Ops    │       │
│   │ • Login     │  │ • Credit Deduct│  │ • File Upload │       │
│   │ • JWT Issue │  │ • Top-up      │  │ • PDF Export  │       │
│   │ • Refresh   │  │ • Expiration  │  │ • Public Share│       │
│   │ • Lockout   │  │ • Validation  │  │ • Ownership   │       │
│   │ • Audit Log │  │               │  │               │       │
│   └─────────────┘  └────────────────┘  └───────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│   │  PostgreSQL  │   │   AWS S3     │   │  Session     │       │
│   │  (Drizzle)   │   │  (Files)     │   │  Store (PG)  │       │
│   │              │   │              │   │              │       │
│   │ 9 tables     │   │ • Photos     │   │ • connect-   │       │
│   │ 13 indexes   │   │ • CVs (PDF)  │   │   pg-simple  │       │
│   │ FK cascades  │   │ • Presigned  │   │              │       │
│   └──────────────┘   └──────────────┘   └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
Client Request
     │
     ▼
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│  Helmet  │ →  │  CORS    │ →  │   Rate    │ →  │  CSRF    │
│ Headers  │    │  Check   │    │  Limiter  │    │  Guard   │
└──────────┘    └──────────┘    └───────────┘    └──────────┘
     │
     ▼
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│ Cookie   │ →  │ require  │ →  │ require   │ →  │ require  │
│ Parser   │    │ Auth     │    │ TenantAcc │    │ Ownership│
└──────────┘    └──────────┘    └───────────┘    └──────────┘
     │
     ▼
┌──────────┐    ┌──────────┐    ┌───────────┐
│ Business │ →  │ Database │ →  │  JSON     │
│  Logic   │    │  Query   │    │ Response  │
└──────────┘    └──────────┘    └───────────┘
```

---

## 5. Database Design

### Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ SUBSCRIPTIONS : has
    USERS ||--o| PROFILES : has
    USERS ||--o{ EDUCATION : has
    USERS ||--o{ PROJECTS : has
    USERS ||--o{ SKILLS : has
    USERS ||--o{ EXPERIENCES : has
    USERS ||--o{ CREDIT_PURCHASES : has
    USERS ||--o{ REFRESH_TOKENS : has

    USERS {
        uuid id PK
        varchar email UK
        text password
        varchar username
        timestamp last_login_at
        integer failed_login_attempts
        timestamp locked_until
        timestamp created_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        varchar plan_type
        integer credits_allocated
        integer credits_remaining
        boolean active
        timestamp start_date
        timestamp end_date
        timestamp created_at
    }

    PROFILES {
        uuid id PK
        uuid user_id FK_UK
        varchar name
        varchar email
        text bio
        text photo_url
        text cv_url
        varchar share_slug UK
        timestamp updated_at
        timestamp created_at
    }

    EDUCATION {
        uuid id PK
        uuid user_id FK
        varchar degree
        varchar university
        varchar duration
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        text link
        varchar duration
        timestamp created_at
    }

    SKILLS {
        uuid id PK
        uuid user_id FK
        varchar name
        varchar proficiency
        timestamp created_at
    }

    EXPERIENCES {
        uuid id PK
        uuid user_id FK
        varchar role
        varchar company
        varchar duration
        text description
        timestamp created_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamp expires_at
        boolean revoked
        text user_agent
        varchar ip_address
        timestamp created_at
    }

    CREDIT_PURCHASES {
        uuid id PK
        uuid user_id FK
        integer credits
        integer amount
        timestamp purchase_date
    }
```

### Tables Summary

| Table              | Purpose                              | Key Columns                                   |
|--------------------|--------------------------------------|-----------------------------------------------|
| `users`            | User accounts and auth state         | email (unique), password (scrypt), lockout     |
| `subscriptions`    | Active plans and credit balances     | plan_type, credits_remaining, active, end_date |
| `profiles`         | User profile data                    | name, bio, photo_url, cv_url, share_slug       |
| `education`        | Education entries                    | degree, university, duration                   |
| `projects`         | Project portfolio entries            | name, description, link                        |
| `skills`           | Skill entries with proficiency       | name, proficiency (Beginner→Expert)            |
| `experiences`      | Work experience entries              | role, company, duration, description           |
| `refresh_tokens`   | JWT refresh token hashes             | token_hash (SHA-256), revoked, device info     |
| `credit_purchases` | Credit top-up transaction records    | credits, amount (in paise)                     |

### Indexes (13 total)

Performance-optimized indexes on all `user_id` foreign keys, `email`, `share_slug`, `token_hash`, and a composite index on `(expires_at, revoked)` for efficient token cleanup.

### Data Integrity

- All child tables use `ON DELETE CASCADE` foreign keys referencing `users(id)`
- `profiles.user_id` has a `UNIQUE` constraint (one profile per user)
- `users.email` has a `UNIQUE` constraint
- `profiles.share_slug` has a `UNIQUE` constraint
- UUIDs (`gen_random_uuid()`) used for all primary keys

---

## 6. Module Breakdown

### 6.1 Authentication Module

**File:** `server/auth.ts` (891 lines)

The authentication module is the largest and most critical module in the system. It implements:

- **Three configurable strategies** — `session`, `jwt`, `hybrid` — selected via `AUTH_STRATEGY` env var
- **Password hashing** with scrypt (64-byte key, 16-byte random salt)
- **Timing-safe comparison** via `crypto.timingSafeEqual` to prevent timing attacks
- **Short-lived access tokens** (15-minute JWT with issuer/audience claims)
- **Refresh token rotation** — each refresh issues a new token and revokes the old one
- **Reuse detection** — if a revoked refresh token is used, all user tokens are revoked (breach alert)
- **Account lockout** — configurable failed attempt threshold (default: 10) with timed lockout (default: 30 min)
- **Audit logging** — structured JSON logs for all auth events (login success/failure, registration, token refresh, lockout, etc.)
- **Input validation** — Zod schemas for registration (email format, password policy) and login
- **Blocked password list** — common passwords like "password1", "123456789" are rejected
- **CSRF token endpoint** — HMAC-signed tokens for double-submit cookie pattern
- **Token cleanup** — periodic background job removes expired refresh tokens from the database

**Key Functions:**

| Function                  | Purpose                                            |
|---------------------------|----------------------------------------------------|
| `hashPassword()`          | scrypt hashing with random salt                    |
| `comparePasswords()`      | Timing-safe password verification                  |
| `generateAccessToken()`   | Short-lived JWT with tenant context                |
| `generateRefreshToken()`  | Cryptographically random 40-byte hex string        |
| `hashToken()`             | SHA-256 hash for secure DB storage                 |
| `verifyAccessToken()`     | JWT verification with issuer/audience validation   |
| `requireAuth()`           | Middleware — session/JWT/hybrid authentication      |
| `requireTenantAccess()`   | Middleware — user can only access own resources     |
| `requireOwnership()`      | Middleware factory — resource-level ownership check |
| `sanitizeUser()`          | Strip sensitive fields from API responses          |
| `auditLog()`              | Structured JSON auth event logging                 |
| `startTokenCleanup()`     | Periodic expired token removal (every 6 hours)     |

---

### 6.2 Security Module

**File:** `server/security.ts` (163 lines)

Centralized security middleware wired into Express before any route handlers:

| Feature             | Implementation                                               |
|---------------------|--------------------------------------------------------------|
| **HTTP Headers**    | Helmet — `X-Content-Type-Options: nosniff`, `X-Frame-Options`, CSP in production |
| **CORS**            | Whitelist-based in production, permissive in development     |
| **Global Rate Limit** | 200 requests / 15 minutes per IP (configurable)           |
| **Auth Rate Limit** | 10 requests / 15 minutes per IP+username (login, register, refresh) |
| **CSRF Protection** | HMAC-signed double-submit cookie pattern; enforced in production only |

---

### 6.3 Subscription & Credit Module

**File:** `server/subscription-service.ts` (293 lines)

A static service class managing the credit-based monetization model:

| Plan      | Price (₹) | Credits | Duration | Features                                   |
|-----------|-----------|---------|----------|---------------------------------------------|
| **Basic** | ₹1,999    | 500     | 30 days  | PDF export, profile sharing, photo/CV upload |
| **Premium** | ₹2,999  | 1,000   | 30 days  | All Basic + priority support                 |

**Credit Costs:**

| Operation           | Credits |
|----------------------|---------|
| Update profile       | 5       |
| Add education entry  | 5       |
| Add project          | 5       |
| Add experience       | 5       |
| Add skill            | 5       |
| Update any entry     | 5       |

**Key Methods:**

- `createSubscription()` — Validates plan, checks for duplicates, sets 30-day expiration
- `getSubscriptionStatus()` — Returns `hasActiveSubscription`, `creditsRemaining`, `canEdit`, `daysUntilExpiry`
- `deductCredits()` — Atomic credit deduction with insufficient-credit validation
- `addCredits()` — Top-up support for additional credit purchases
- `validateAccess()` — Pre-flight check before allowing credit-consuming operations

---

### 6.4 Profile Management Module

**File:** `server/routes.ts` (1,390 lines)

Full CRUD operations for all profile entities, all protected by the authentication and tenant isolation middleware chain:

```
requireAuth → requireTenantAccess → [requireOwnership on DELETE] → Business Logic
```

**Supported Entities:** Profile, Education, Projects, Skills, Experiences

Each mutation (create/update) deducts 5 credits from the user's active subscription. Delete operations verify resource ownership before allowing deletion.

**Special Features:**
- **Public profile sharing** via `share_slug` — generates a random hex slug and serves the profile publicly at `/profile/share/:shareSlug`
- **Photo upload** — Multer middleware → S3 upload → URL stored in profile
- **CV upload** — PDF-only upload to S3
- **Presigned URL generation** — for direct client-side uploads

---

### 6.5 File Upload Module (S3)

**File:** `server/s3-service.ts` (197 lines)

AWS S3 integration for file storage with:

- Server-side uploads via Multer (memory storage → S3)
- Presigned URL generation for direct client-side uploads
- File deletion support
- CloudFront CDN URL generation (optional)
- Key extraction from S3/CloudFront URLs
- Configuration validation (`isConfigured()`)

---

### 6.6 PDF Export Module

**File:** `client/src/lib/pdf-generator.ts` (187 lines)

Client-side PDF generation using jsPDF:

- Generates a professional PDF with sections: Header, Contact, Summary, Education, Experience, Projects, Skills
- Automatic page breaks when content exceeds page height
- Timestamped filename generation
- Supports all profile data fields

---

### 6.7 Client-Side Module

**Pages (3,113 lines total):**

| Page                    | File                          | Lines | Purpose                           |
|-------------------------|-------------------------------|-------|-----------------------------------|
| Landing Page            | `landing-page.tsx`            | 170   | Marketing homepage                |
| Auth Page               | `auth-page.tsx`               | 434   | Login/Register with form validation |
| Auth (Minimal)          | `auth-minimal.tsx`            | 148   | Simplified auth form              |
| Subscription Page       | `subscription-page.tsx`       | 184   | Plan selection and purchase        |
| Profile Builder         | `profile-builder-page.tsx`    | 1,466 | Main profile editing interface     |
| Public Profile          | `public-profile-page.tsx`     | 618   | Read-only shared profile view      |
| 404 Page                | `not-found.tsx`               | 20    | Not found handler                  |

**Hooks (444 lines total):**

| Hook           | Purpose                                                          |
|----------------|------------------------------------------------------------------|
| `useAuth()`    | AuthContext provider — login, register, logout, token management |
| `useSubscription()` | Subscription status — derived from auth context             |
| `useMobile()`  | Responsive breakpoint detection                                  |
| `useToast()`   | Toast notification state management                              |

**Libraries (567 lines total):**

| Library          | Purpose                                                      |
|------------------|--------------------------------------------------------------|
| `queryClient.ts` | React Query config, JWT/CSRF token management, auto-refresh  |
| `protected-route.tsx` | Route guard components (auth, subscription, credits)    |
| `pdf-generator.ts` | jsPDF profile export                                       |
| `utils.ts`       | Tailwind `cn()` merge utility                               |

**UI Components:** 40+ Radix UI-based components (4,790 lines) — accordion, dialog, toast, tabs, cards, forms, etc.

---

## 7. Authentication — Deep Dive

### Strategy Comparison & Recommendation

| Criteria              | Session-Based       | JWT                   | Hybrid (Recommended)  |
|-----------------------|--------------------|-----------------------|----------------------|
| **Scalability**       | ⚠️ Server state   | ✅ Stateless          | ✅ Best of both       |
| **Microservices**     | ❌ Single server   | ✅ Cross-service      | ✅ Cross-service      |
| **Debugging**         | ✅ Simple          | ⚠️ Token inspection  | ✅ Session in dev     |
| **Security**          | ✅ Server control  | ⚠️ Token management  | ✅ Combined           |
| **Token Revocation**  | ✅ Instant         | ⚠️ Requires DB check | ✅ Refresh rotation   |
| **Best For**          | Dev / Small apps   | Production / APIs     | **Multi-tenant SaaS** |

**Recommendation:** The **Hybrid approach** is recommended for Canar's multi-tenant SaaS model because:

1. Sessions provide easy debugging in development
2. JWTs enable stateless scaling in production
3. Short-lived access tokens (15 min) limit exposure window
4. Refresh token rotation with reuse detection provides security comparable to session-based auth
5. The `AUTH_STRATEGY` env var allows seamless switching between environments

### JWT Token Architecture

```
Access Token (15 min)                 Refresh Token (7 days)
┌─────────────────────┐               ┌─────────────────────┐
│ Header              │               │ 40 random bytes     │
│   alg: HS256        │               │ (hex encoded)       │
│ Payload             │               │                     │
│   id: user UUID     │               │ Stored in DB as     │
│   email: string     │               │ SHA-256 hash        │
│   tenantId: user ID │               │                     │
│   type: "access"    │               │ Sent as httpOnly    │
│   iss: "canar-api"  │               │ cookie on /api/auth │
│   aud: "canar-client"│              │ path only           │
│   jti: unique ID    │               │                     │
│   exp: +15 min      │               │ exp: +7 days        │
└─────────────────────┘               └─────────────────────┘
```

### Refresh Token Rotation Flow

```
1. Client → POST /api/auth/refresh (cookie: refresh_token=ABC)
2. Server → Hash ABC → look up in DB
3. If found and NOT revoked:
   a. Revoke old token (mark revoked=true)
   b. Generate new refresh token XYZ
   c. Store SHA-256(XYZ) in DB
   d. Issue new access token
   e. Set new cookie: refresh_token=XYZ
4. If found and IS revoked (REUSE DETECTED):
   a. Revoke ALL user's refresh tokens (security breach)
   b. Log TOKEN_REUSE_DETECTED audit event
   c. Return 401
```

### Account Lockout Flow

```
Login Attempt
     │
     ▼
┌──────────────────┐    No     ┌──────────────────┐
│ Account locked?  │ ────────→ │ Verify password  │
│ (lockedUntil >   │           │                  │
│  current time)   │           └────────┬─────────┘
└────────┬─────────┘                    │
         │ Yes                    ┌─────┴─────┐
         ▼                    Success      Failure
    Return 401               │              │
    "Account locked"         ▼              ▼
                       Reset counter   Increment counter
                       Update last     counter >= 10?
                       login time      ────→ Lock 30 min
                       Issue tokens
```

---

## 8. API Reference

### Authentication Endpoints

| Method | Path                    | Auth | Description                          |
|--------|------------------------|------|--------------------------------------|
| POST   | `/api/register`        | No   | Register new user                    |
| POST   | `/api/login`           | No   | Login with credentials               |
| POST   | `/api/logout`          | Yes  | Logout and revoke tokens             |
| GET    | `/api/user`            | Yes  | Get current user info                |
| POST   | `/api/auth/refresh`    | No*  | Refresh access token (cookie-based)  |
| GET    | `/api/auth/csrf-token` | No   | Get CSRF token                       |
| GET    | `/api/auth/health`     | No   | Health check with strategy info      |

### Subscription Endpoints

| Method | Path                              | Auth | Description                    |
|--------|-----------------------------------|------|--------------------------------|
| GET    | `/api/subscription/plans`         | Yes  | List available plans           |
| POST   | `/api/subscription/subscribe`     | Yes  | Subscribe to a plan            |
| GET    | `/api/credits`                    | Yes  | Get credit status              |
| POST   | `/api/subscription/credits/topup` | Yes  | Purchase additional credits    |

### Profile Endpoints

| Method | Path                     | Auth | Credits | Description                 |
|--------|-------------------------|------|---------|-----------------------------|
| GET    | `/api/profile`          | Yes  | 0       | Get user profile            |
| PUT    | `/api/profile`          | Yes  | 5       | Update profile              |
| GET    | `/api/education`        | Yes  | 0       | List education entries      |
| POST   | `/api/education`        | Yes  | 5       | Add education entry         |
| PUT    | `/api/education/:id`    | Yes  | 5       | Update education entry      |
| DELETE | `/api/education/:id`    | Yes  | 0       | Delete education entry      |
| GET    | `/api/projects`         | Yes  | 0       | List projects               |
| POST   | `/api/projects`         | Yes  | 5       | Add project                 |
| PUT    | `/api/projects/:id`     | Yes  | 5       | Update project              |
| DELETE | `/api/projects/:id`     | Yes  | 0       | Delete project              |
| GET    | `/api/skills`           | Yes  | 0       | List skills                 |
| POST   | `/api/skills`           | Yes  | 5       | Add skill                   |
| PUT    | `/api/skills/:id`       | Yes  | 5       | Update skill                |
| DELETE | `/api/skills/:id`       | Yes  | 0       | Delete skill                |
| GET    | `/api/experiences`      | Yes  | 0       | List experiences            |
| POST   | `/api/experiences`      | Yes  | 5       | Add experience              |
| PUT    | `/api/experiences/:id`  | Yes  | 5       | Update experience           |
| DELETE | `/api/experiences/:id`  | Yes  | 0       | Delete experience           |

### File Upload Endpoints

| Method | Path                    | Auth | Description                    |
|--------|------------------------|------|--------------------------------|
| POST   | `/api/upload/photo`    | Yes  | Upload profile photo (S3)     |
| POST   | `/api/upload/cv`       | Yes  | Upload CV as PDF (S3)         |

### Public Endpoints

| Method | Path                          | Auth | Description                    |
|--------|-------------------------------|------|--------------------------------|
| GET    | `/api/profile/share/:slug`    | No   | Get public shared profile      |

---

## 9. Security Implementation

### Defense-in-Depth Layers

| Layer | Mechanism                     | Implementation                                |
|-------|-------------------------------|-----------------------------------------------|
| 1     | **Network**                   | CORS whitelist, rate limiting, Helmet headers  |
| 2     | **Authentication**            | JWT + session hybrid, scrypt password hashing  |
| 3     | **Authorization**             | `requireAuth` → `requireTenantAccess` → `requireOwnership` |
| 4     | **Input Validation**          | Zod schemas, password policy, blocked list     |
| 5     | **Data Protection**           | `sanitizeUser()` strips sensitive fields, httpOnly cookies |
| 6     | **Token Security**            | Short-lived access (15m), refresh rotation, reuse detection |
| 7     | **Database**                  | FK constraints, prepared statements, cascade deletes |
| 8     | **Audit**                     | Structured JSON logs for all auth events       |

### Password Policy

- Minimum 8 characters, maximum 128
- Must contain: lowercase, uppercase, number
- Blocked common passwords (12 entries)
- Hashing: scrypt with 64-byte key derivation and 16-byte random salt
- Comparison: `crypto.timingSafeEqual` (constant-time)

### Security Headers (via Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy` (production only)
- `Strict-Transport-Security` (production)
- `X-XSS-Protection`
- `Referrer-Policy`

---

## 10. Testing & Validation

### Production Test Suite

**File:** `test-auth-production.js` (361 lines, 43 test cases)

The production auth test suite validates the complete authentication and security lifecycle:

| Test Category                  | Tests | Details                                            |
|--------------------------------|-------|----------------------------------------------------|
| **Health Check**               | 3     | Endpoint status, strategy reporting                |
| **Security Headers**           | 2     | X-Content-Type-Options, frame protection           |
| **CSRF Token**                 | 3     | Endpoint, token format, signature validation       |
| **Input Validation**           | 6     | Missing email, invalid format, weak passwords, common passwords |
| **Registration**               | 6     | Success, token returned, password not leaked, duplicate rejection |
| **User Info**                  | 5     | Correct user, sensitive fields stripped             |
| **Unauthenticated Access**     | 1     | Protected route returns 401                        |
| **Logout**                     | 2     | Logout success, token invalidation                 |
| **Login**                      | 6     | Success, bad password, non-existent user           |
| **Token Refresh**              | 4     | Refresh success, new token works                   |
| **Token Rotation**             | 2     | Rotation succeeds, reuse returns 401               |
| **Tenant Isolation**           | 2     | User 2 sees only own data                          |
| **Rate Limiting**              | 1     | Rate limit headers present                         |
| **Total**                      | **43**| **All 43 passing ✅**                              |

### Test Results

```
════════════════════════════════════════════════════════════
  Canar Auth Production Test Suite
  Target: http://localhost:3000
════════════════════════════════════════════════════════════

  Results: 43 passed, 0 failed ✅
```

---

## 11. Deployment Architecture

### AWS Cloud Deployment

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Route 53      │    │   CloudFront    │    │   S3 Static     │
│   (DNS)         │────│   (CDN)         │────│   (Frontend)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   RDS           │    │   ElastiCache   │
│   Load Balancer │────│   PostgreSQL    │────│   Redis         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   ECS Fargate   │
│   (Backend)     │
└─────────────────┘
```

### Environment Configuration

| Variable                         | Description                        | Default                  |
|----------------------------------|------------------------------------|--------------------------|
| `DATABASE_URL`                   | PostgreSQL connection string       | (required)               |
| `NODE_ENV`                       | Environment                        | `development`            |
| `PORT`                           | Server port                        | `5000`                   |
| `AUTH_STRATEGY`                  | `session` / `jwt` / `hybrid`      | `jwt`                    |
| `JWT_SECRET`                     | JWT signing secret                 | (required in production) |
| `JWT_EXPIRES_IN`                 | Access token lifetime              | `15m`                    |
| `SESSION_SECRET`                 | Session encryption key             | (required in production) |
| `CORS_ORIGIN`                    | Allowed CORS origins               | `http://localhost:3000`  |
| `RATE_LIMIT_MAX_REQUESTS`        | Global rate limit (per 15 min)     | `200`                    |
| `RATE_LIMIT_AUTH_MAX`            | Auth rate limit (per 15 min)       | `10`                     |
| `MAX_FAILED_LOGIN_ATTEMPTS`      | Lockout threshold                  | `10`                     |
| `ACCOUNT_LOCKOUT_MINUTES`        | Lockout duration                   | `30`                     |
| `TOKEN_CLEANUP_INTERVAL_HOURS`   | Expired token cleanup frequency    | `6`                      |
| `AWS_ACCESS_KEY_ID`              | S3 credentials                     | (optional)               |
| `AWS_SECRET_ACCESS_KEY`          | S3 credentials                     | (optional)               |
| `AWS_S3_BUCKET_NAME`            | S3 bucket name                     | `canar-profile-builder`  |
| `CLOUDFRONT_DOMAIN`             | CDN domain for S3 files            | (optional)               |

### Estimated Monthly Cloud Costs

| Service              | Monthly Cost |
|----------------------|--------------|
| ECS Fargate          | $50–100      |
| RDS PostgreSQL       | $30–60       |
| ElastiCache Redis    | $15–30       |
| Application LB       | $20–40       |
| CloudFront CDN       | $5–15        |
| Route 53             | $0.50        |
| S3 Storage           | $1–5         |
| CloudWatch           | $5–15        |
| **Total**            | **$126–265** |

---

## 12. Codebase Statistics

### Lines of Code (Custom Code Only)

| Component           | Files | Lines   | Description                          |
|---------------------|-------|---------|--------------------------------------|
| **Server**          | 10    | 3,901   | API, auth, security, services        |
| **Shared Schema**   | 1     | 207     | Drizzle ORM schema + types           |
| **Client Pages**    | 10    | 3,113   | React page components                |
| **Client Hooks**    | 3     | 444     | Custom React hooks                   |
| **Client Lib**      | 4     | 567     | Utilities, query client, PDF gen     |
| **UI Components**   | 40+   | 4,790   | Radix-based component library        |
| **Test Suites**     | 3     | ~830    | Auth tests (production + enhanced)   |
| **Total**           | **71+** | **~13,850** | **Full application**            |

### Key Server Files

| File                       | Lines | Purpose                                |
|----------------------------|-------|----------------------------------------|
| `server/routes.ts`         | 1,390 | All API route handlers                 |
| `server/auth.ts`           | 891   | Authentication system                  |
| `server/storage.ts`        | 492   | Database access layer (Drizzle)        |
| `server/db-setup.ts`       | 344   | DB initialization, migrations, seeding |
| `server/subscription-service.ts` | 293 | Subscription & credit management  |
| `server/s3-service.ts`     | 197   | AWS S3 file operations                 |
| `server/security.ts`       | 163   | Helmet, CORS, rate limiting, CSRF      |
| `server/index.ts`          | 113   | Express app bootstrap                  |

### Dependencies

| Category    | Count | Notable Packages                                       |
|-------------|-------|-------------------------------------------------------|
| Production  | 63    | express, drizzle-orm, jsonwebtoken, passport, zod, react, vite |
| Dev         | 16    | typescript, tsx, nodemon, drizzle-kit, esbuild         |

---

## 13. Future Scope

1. **Payment Gateway Integration** — Stripe/Razorpay for real subscription billing
2. **Email Verification** — OTP or magic-link email verification on registration
3. **Admin Dashboard** — Subscription analytics, user management, audit log viewer
4. **Multi-language Support** — i18n for profile content and UI
5. **Template System** — Multiple PDF/profile templates for export
6. **OAuth Social Login** — Google, GitHub, LinkedIn login integration
7. **Real-time Collaboration** — WebSocket-based live profile co-editing
8. **API Key Management** — Programmatic API access for external integrations
9. **Search & Discovery** — Public profile search and discovery features
10. **Mobile App** — React Native companion app

---

## 14. Conclusion

**Canar** is a production-ready, multi-tenant SaaS application that demonstrates a comprehensive implementation of:

- **Production-grade authentication** with JWT/session hybrid strategy, refresh token rotation with reuse detection, account lockout, audit logging, and configurable security policies
- **Multi-tenant data isolation** enforced at three levels: API middleware (`requireTenantAccess`), resource ownership verification (`requireOwnership`), and database foreign key constraints
- **Credit-based subscription model** with plan management, credit deduction on profile edits, top-up support, and expiration handling
- **Secure API design** with defense-in-depth: Helmet headers, CORS, dual-tier rate limiting, CSRF protection, input validation (Zod), and sensitive data stripping
- **Full-stack TypeScript** with type-safe database access (Drizzle ORM), validated API inputs, and shared schema between client and server

The system has been validated with **43 automated test cases** covering the complete authentication lifecycle, security headers, input validation, token rotation, tenant isolation, and rate limiting — all passing successfully.

---

*Report generated on June 1, 2026*
*Canar — SPA Profile Builder v1.0.0*

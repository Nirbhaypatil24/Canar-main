# Canar — AI-Powered Recruitment & Profile Builder Platform

A comprehensive SaaS application with **Role-Based Access Control**, AI-powered CV parsing, natural language candidate search, professional profile building, subscription management, and multi-tenant architecture.

## 🚀 Features

### Role-Based Access Control

- **Two User Roles**: Register as a **Candidate** or a **Recruiter**
- **Candidate Dashboard**: Upload & parse your CV with AI, build a professional profile, export PDF, share via public link
- **Recruiter Dashboard**: Search candidates using natural language AI queries across the entire candidate pool
- **Route Protection**: Frontend and backend enforce role-based access

### AI-Powered Features

- **AI CV Parser** (All Users): Upload a PDF resume → AI (Groq/LLaMA) extracts structured candidate data (name, skills, experience, education, projects, certifications)
- **AI Candidate Search** (Recruiter Only): Type a natural language query like *"React developer with 3+ years from Pune"* → AI parses intent and matches candidates from the **global** candidate pool
- **Excel Import**: Bulk import candidates from `.xlsx` spreadsheets

### Authentication & Security

- **Dual Authentication Modes**: Session-based (development) and JWT (production)
- **Multi-tenant Architecture**: Complete tenant isolation
- **Password Security**: scrypt hashing with salt, blocked common passwords, account lockout
- **Token Management**: Short-lived access tokens (15m) + httpOnly refresh token cookies (7d)
- **Rate Limiting**: Built-in protection against brute-force attacks

### Subscription & Credits

- **Credit-based System**: Pay-per-action model (edits, CV parses, searches)
- **Plan Management**: Basic (₹1,999/mo, 500 credits) and Premium (₹2,999/mo, 1000 credits)
- **Top-up System**: Purchase additional credits
- **Expiration Handling**: Automatic subscription expiry management

### Profile Builder (All Users)

- **Section Editor**: Education, experience, projects, skills with autosave
- **PDF Export**: Generate a professional resume PDF from your profile
- **Photo & CV Upload**: Attach profile photo and CV documents
- **Shareable Link**: Public profile page via unique slug

### Database & Performance

- **PostgreSQL**: Robust relational database with Drizzle ORM
- **Automated Setup**: Database initialization, migrations, validation on startup
- **Performance Indexes**: Optimized queries for search and lookups

## 🏗️ Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Auth Service  │  │  Subscription   │  │   Profile       │  │   AI Service    │
│                 │  │   Service       │  │   Service       │  │   (Groq LLaMA)  │
│ • Registration  │  │ • Plan Mgmt     │  │ • CRUD Ops      │  │ • CV Parsing    │
│ • Login/Logout  │  │ • Credit Mgmt   │  │ • File Upload   │  │ • NL Search     │
│ • JWT Tokens    │  │ • Billing       │  │ • PDF Export    │  │ • Intent Parse  │
│ • Role RBAC     │  │ • Top-ups       │  │ • Public Share  │  │ • Excel Import  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │                    │
         └────────────────────┼─────────────────────┼────────────────────┘
                              │                     │
                 ┌────────────┴─────────────────────┴──────────┐
                 │              PostgreSQL Database             │
                 │                                              │
                 │  users · subscriptions · profiles · skills   │
                 │  education · projects · experiences          │
                 │  candidates · refresh_tokens · purchases     │
                 └──────────────────────────────────────────────┘
```

### User Flow

```
                  ┌──────────────┐
                  │   /auth      │
                  │  Login/Signup │
                  │  (role pick) │
                  └──────┬───────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
     ┌────────────────┐    ┌────────────────┐
     │   Candidate    │    │   Recruiter    │
     │                │    │                │
     │ /candidates    │    │ /candidates    │
     │ AI CV Parser   │    │ AI CV Parser   │
     │                │    │ Excel Import   │
     │ /profile       │    │                │
     │ Profile Builder│    │ /search        │
     │ PDF Export     │    │ AI Candidate   │
     │ Share Link     │    │ Search (NLP)   │
     │                │    │ (global pool)  │
     └────────────────┘    └────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn
- A [Groq API key](https://console.groq.com/) (for AI features)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd Canar-main
npm install --legacy-peer-deps
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/canar_db

# Authentication
AUTH_STRATEGY=hybrid      # session | jwt | hybrid
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-key

# AI (Groq — powers CV parsing & candidate search)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Environment
NODE_ENV=development
PORT=3000

# Security
CORS_ORIGIN=http://localhost:3000
```

### 3. Database Setup

```bash
# The database will be automatically set up on first run
npm run dev
```

### 4. Run the Application

```bash
# Development mode (with hot-reload)
npm run dev

# Production build
npm run build
npm start
```

## 📊 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | User registration (accepts `role`: `candidate` or `recruiter`) |
| `POST` | `/api/login` | User login |
| `POST` | `/api/logout` | User logout |
| `GET` | `/api/user` | Get current user (includes `role`) |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `GET` | `/api/auth/health` | Auth health check |

### Subscription & Credits

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subscription/plans` | List available plans |
| `POST` | `/api/subscription/subscribe` | Create subscription |
| `GET` | `/api/credits` | Get credit balance |
| `POST` | `/api/subscription/credits/topup` | Purchase additional credits |

### Profile Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update profile (costs 5 credits) |
| `GET/POST/PUT/DELETE` | `/api/education[/:id]` | Manage education entries |
| `GET/POST/PUT/DELETE` | `/api/projects[/:id]` | Manage project entries |
| `GET/POST/PUT/DELETE` | `/api/skills[/:id]` | Manage skill entries |
| `GET/POST/PUT/DELETE` | `/api/experiences[/:id]` | Manage experience entries |

### AI & Candidate Management (Recruiter Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/candidates/parse-cv` | Upload & AI-parse a CV (PDF) |
| `POST` | `/api/candidates/search` | AI-powered natural language search |
| `POST` | `/api/candidates/import-excel` | Bulk import from Excel |
| `GET` | `/api/candidates` | List all candidates |
| `GET` | `/api/candidates/stats` | Candidate pool statistics |
| `GET` | `/api/candidates/:id` | Get a single candidate |
| `DELETE` | `/api/candidates/:id` | Delete a candidate |

## 🔒 Security Features

- ✅ **Password Hashing**: scrypt with random salt
- ✅ **Blocked Passwords**: Common passwords rejected at registration
- ✅ **Account Lockout**: 10 failed attempts → 30 minute lockout
- ✅ **JWT Access Tokens**: 15-minute expiry, signed with HS256
- ✅ **Refresh Tokens**: Hashed in DB, httpOnly cookie, 7-day expiry
- ✅ **Tenant Isolation**: Users can only access their own data
- ✅ **Role-Based Access**: Backend + frontend enforce Candidate vs Recruiter permissions
- ✅ **Input Validation**: Zod schemas on all endpoints
- ✅ **CORS Protection**: Configurable origin whitelist
- ✅ **Rate Limiting**: Request throttling on auth endpoints
- ✅ **Audit Logging**: Structured JSON logs for all auth events

## 🧪 Testing

```bash
# Run comprehensive test suite
node test-auth.js

# Run database integration tests
node test-db-integration.js

# Run navigation flow tests
node test-navigation-flow.js
```

## 🔧 Configuration Options

### Authentication Strategies

| Strategy | Best For | Notes |
|----------|----------|-------|
| `session` | Development | Simple debugging, built-in CSRF |
| `jwt` | Production | Stateless, scalable, microservice-friendly |
| `hybrid` | Recommended | Session in dev, JWT in prod |

### Subscription Plans

| Plan | Price | Credits | Features |
|------|-------|---------|----------|
| Basic | ₹1,999/mo | 500 | PDF export, profile sharing, photo upload |
| Premium | ₹2,999/mo | 1,000 | All Basic + priority support |

## 🚀 AWS Cloud Deployment

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Route 53 │───▶│CloudFront│───▶│ S3 Static│
│  (DNS)   │    │  (CDN)   │    │(Frontend)│
└──────────┘    └──────────┘    └──────────┘
      │               │
      ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│   ALB    │───▶│   RDS    │    │  Redis   │
│  (LB)   │    │(Postgres)│    │(Cache)   │
└──────────┘    └──────────┘    └──────────┘
      │
      ▼
┌──────────┐
│  ECS     │
│ Fargate  │
│(Backend) │
└──────────┘
```

### Estimated Monthly Costs: $126–265

| Service | Cost |
|---------|------|
| ECS Fargate | $50–100 |
| RDS PostgreSQL | $30–60 |
| ElastiCache Redis | $15–30 |
| ALB | $20–40 |
| CloudFront | $5–15 |
| Route 53 | $0.50 |
| S3 | $1–5 |
| CloudWatch | $5–15 |

## 📚 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Auth | JWT (jsonwebtoken), Passport.js, scrypt |
| AI | Groq SDK (LLaMA 3), Zod structured output |
| PDF | pdf-parse (v1), html2canvas, jsPDF |
| File Upload | Multer |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `node test-auth.js`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for secure, scalable SaaS recruitment**

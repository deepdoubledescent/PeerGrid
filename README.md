# PeerGrid

A web platform that connects researchers by matching them based on their publication history, research topics, and expertise — powered by the [OpenAlex](https://openalex.org/) academic graph.

**Live at** [peer-grid.de](https://www.peer-grid.de)

---

## What It Does

PeerGrid helps researchers find collaborators, discover relevant projects, and stay connected with their academic community. Users link their OpenAlex profile (or create one manually), and the platform uses their publication data to:

- **Recommend collaborators** via a nightly matchmaking pipeline that scores researcher similarity using topic overlap and paper embeddings
- **Surface relevant projects** — labs, open positions, and research collaborations — filterable by topic, skill, location, and institution
- **Facilitate academic discussion** through posts, paper comments (with LaTeX/KaTeX support), and an activity feed
- **Organize events** with creation, search, and registration workflows
- **Verify institutional affiliation** through email-based domain verification

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                        │
│  Hosted on S3 + CloudFront · CI/CD via GitHub Actions           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│  Backend API (Node.js on AWS Lambda)                            │
│  API Gateway · JWT auth via Cognito · Presigned S3 uploads      │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────────────┐
   │  MySQL    │  │  AWS S3   │  │  Matchmaking       │
   │  (RDS)   │  │  (files)  │  │  Lambda (Python)   │
   └───────────┘  └───────────┘  └───────────────────┘
                                   Nightly batch via
                                   EventBridge
```

### Matchmaking Pipeline

A scheduled Lambda pipeline runs nightly to compute researcher-to-researcher recommendations:

1. **Embedding phase** — An embedding manager sends unprocessed paper abstracts to a MiniLM model Lambda and stores the resulting vectors
2. **Matching phase** — A Python Lambda loads all embeddings and topic profiles, then scores each pair using a weighted combination of:
   - Hierarchical topic similarity (topic → subfield → field, weighted 1.0 / 0.4 / 0.1)
   - Cosine similarity between paper embeddings
   - Co-author exclusion to promote novel connections

See [`backend/lambda_matchmaking/`](backend/lambda_matchmaking/) for implementation details.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js (ES Modules), AWS Lambda, API Gateway |
| Auth | AWS Cognito (OAuth2 + JWT) |
| Database | MySQL (AWS RDS) |
| Storage | AWS S3 (presigned URLs for uploads) |
| ML / Matching | Python, NumPy, MiniLM embeddings |
| External API | OpenAlex (author profiles, papers, topics, institutions) |
| CI/CD | GitHub Actions → S3 + CloudFront invalidation |

---

## Project Structure

```
PeerGrid/
├── frontend/                 # React SPA
│   └── src/
│       ├── App.jsx           # Routing and layout
│       ├── Controller.jsx    # API client (all backend calls)
│       ├── auth.js           # Cognito token management
│       ├── ProjectsPage.jsx  # Project search with advanced filters
│       ├── OpenAlexSetupPage  # Onboarding: OpenAlex profile linking
│       ├── UserPage.jsx      # Profile pages
│       └── ...               # Posts, events, papers, people, etc.
│
├── backend/
│   ├── index.js              # Lambda handler — routing + auth middleware
│   ├── db.js                 # MySQL connection pool
│   ├── handlers/
│   │   └── auth.js           # Cognito post-auth hook (user sync)
│   ├── services/
│   │   ├── userService.js    # User CRUD, likes, comments, recommendations
│   │   ├── projectService.js # Projects, applications, search & filtering
│   │   ├── postService.js    # Posts and threaded comments
│   │   ├── eventService.js   # Events lifecycle
│   │   ├── mailService.js    # Institution verification (magic code)
│   │   ├── s3Presign.js      # Presigned URL generation
│   │   └── notificationService.js
│   └── lambda_matchmaking/
│       ├── matchmaking.py    # Scoring algorithm (ResearchMatcherV6)
│       └── README.md         # Pipeline documentation
│
└── .github/workflows/
    └── deploy.yml            # CI/CD: build → S3 → CloudFront
```

---

## Key Features

- **OpenAlex Integration** — Auto-import publications, citations, h-index, topics, and co-author networks on signup
- **Smart Recommendations** — Content-based filtering using both topic hierarchy overlap and semantic similarity of paper abstracts
- **Project Board** — Create, search, and apply to research projects with document uploads (CV, cover letter)
- **Markdown Posts** — Rich-text posts with LaTeX math rendering and threaded comments
- **Academic Events** — Create and discover conferences, workshops, and meetups
- **People Discovery** — Browse and filter researchers by institution, country, field, and skills
- **Institution Verification** — Email-based verification using institution domain matching
- **Notification Piggybacking** — New notifications are delivered as piggyback payloads on every API response, avoiding extra polling

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm

### Frontend (local development)

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

> **Note:** The frontend connects to the production API by default. To run the full stack locally, you would need to configure your own AWS services (Cognito, RDS, S3, Lambda).

---

## License

[MIT](LICENSE)

# ReachInbox Email Job Scheduler — Evaluator Documentation

Welcome to the ReachInbox Email Job Scheduler project! This system has been designed and built specifically for the **Placement Elimination Round / Hiring Assignment**.

This document outlines the project goals, setup procedures, and a guide to the codebase and constraints compliance.

---

## Technical Highlights & Strict Constraints Compliance

*   **❌ No Cron Constraint**: The scheduling mechanism contains **zero** OS-level crontabs or Node-level cron libraries (no `node-cron`, `agenda`, etc.). All future sends are scheduled dynamically using **BullMQ's Redis-backed delayed job queue**.
*   **🔄 Restart Durability**: All jobs survive server restarts. If the Express backend or worker process crashes mid-queue, the delayed jobs persist securely in Redis (backed by Append-Only File `AOF` persistence) and catch up automatically upon restart.
*   **⚡ Concurrency-Safe Rate Limiting**: The system enforces per-sender hourly limits using atomic Redis counters (`INCR` + `EXPIRE`). It remains completely safe under concurrent workloads across multiple worker processes.
*   **🔍 Full-Text Search**: Email subject lines, recipient addresses, and message bodies are indexed in real-time inside **Elasticsearch**, enabling instant search capabilities.
*   **💬 Slack Integration**: A live Slack OAuth callback connects Slack workspaces, and sends a webhook alert immediately when a sender's hourly limit is hit.

---

## Documentation Index

We have separated our documentation into two folders to simplify review and learning:

### 📁 Evaluator Folder (`docs/evaluator/`)
*   [`README.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/README.md) (This file) — Installation, environment variables, and testing guide.
*   [`Architecture.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/Architecture.md) — System flow diagrams, database schemas, and service layouts.
*   [`Trade-offs.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/Trade-offs.md) — Rationale behind structural choices (BullMQ vs. custom database polling, etc.).
*   [`Verification_Logs.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/Verification_Logs.md) — Proof of restart-safe execution showing actual console logs.
*   [`Testing_Session.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/Testing_Session.md) — Testing Session Report listing test scenarios, errors, solutions, and alternatives.
*   [`Frontend_Testing.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/evaluator/Frontend_Testing.md) — Frontend Testing Report outlining verified checklist items and UI mechanics.

### 📁 Learning Folder (`docs/learning/`)
*   [`Step_by_Step_Guide.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/learning/Step_by_Step_Guide.md) — Development log detailing steps 1 to 10.
*   [`Concepts.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/learning/Concepts.md) — Educational deep dives into BullMQ internal architecture, Redis atomic transactions, etc.
*   [`Troubleshooting.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/learning/Troubleshooting.md) — Quick solutions for Docker, Elasticsearch heap limit, and database connectivity.
*   [`Local_Testing.md`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docs/learning/Local_Testing.md) — Practical guide to triggering and verifying rate limits, mock auth, and Slack messages.

---

## Quick Start & Running Locally

### Prerequisites
*   Node.js v18 or newer
*   Docker & Docker Compose

### 1. Start Service Infrastructure
In the project root folder, spin up PostgreSQL, Redis, and Elasticsearch containers:
```bash
docker compose up -d
```
Verify that all containers are healthy:
```bash
docker ps
```

### 2. Configure Environment Variables
Create a `.env` file inside the `backend/` directory. You can start with our provided template:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler

# OPTIONAL: Configure for real Google OAuth (OAuth fallback bypass will be used if omitted)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# OPTIONAL: Configure for real Slack OAuth (mock webhook will be used if omitted)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

### 3. Initialize the Database
Install dependencies and create tables via Prisma Next:
```bash
cd backend
npm install
npx prisma contract emit
npx prisma db init
```

### 4. Run the Application
Start the backend Express server and BullMQ background worker:
```bash
npm run dev
```
The server will boot on port `5000` and output:
`[Auth] WARNING: GOOGLE_CLIENT_ID is missing. Mock authentication bypass will be used.`
`Server is running on port 5000`

---

## Evaluation Helper: Dual-Mode Design
To facilitate immediate review without registering external developer credentials, we implemented a **Dual-Mode** bypass:
1.  **Google Login**: If `GOOGLE_CLIENT_ID` is omitted, the login flow redirects to `/auth/mock-login`, creating a default user (`dev@reachinbox.com`) and logging them in instantly.
2.  **Slack Alerts**: If `SLACK_CLIENT_ID` is missing, the "Connect Slack" button automatically links a mock webhook. You can also manually submit a webhook URL to `/slack/connect-webhook` to verify live notifications.

# Step-by-Step Learning Guide

This guide details the exact steps we have taken to initialize the project, setup the infrastructure, and define the database schema.

---

## Step 1: Initialize Project Structure & TS Config
We created the core directory structure:
*   `docs/evaluator/`: Contains professional architectural write-ups and verification logs for the evaluators.
*   `docs/learning/`: Contains step-by-step guides, concept breakdowns, and testing scenarios for you.
*   `backend/`: Express.js backend folder.

### Installing TypeScript, Express, and tsx
We initialized the Node project inside `backend/` and installed:
*   `express`, `cors`, `dotenv` for the server
*   `typescript`, `@types/express`, `@types/node`, `@types/cors`, and `tsx` for running and compiled TypeScript.

We configured `tsconfig.json` to use modern `node16` module resolution, and added a startup script to `package.json`:
```json
"dev": "tsx watch src/index.ts"
```
This runs the compiler in watch-mode, automatically reloading when files change.

---

## Step 2: Infrastructure Configuration
We defined `docker-compose.yml` in the root folder containing three services:
1.  **PostgreSQL 15** for relational persistence of campaigns and email logs.
2.  **Redis 7** (running with append-only mode enabled `redis-server --appendonly yes`) to act as the durable backer for BullMQ delayed queues and rate-limiting atomic counters.
3.  **Elasticsearch 8.11** to index scheduled/sent email logs for fast full-text searching.

---

## Step 3: Database & Schema Migration
We installed and set up **Prisma ORM (Prisma Next)**.
In Prisma Next:
*   The data contract is defined at `src/prisma/contract.prisma`.
*   We defined models for `User`, `Sender`, `Campaign`, `Email` (with status enum: `scheduled`, `sent`, `failed`), and `SlackIntegration`.
*   Primary keys are generated as UUIDs.
*   We run `npx prisma contract emit` to compile the contract schema into typescript typings (`contract.d.ts`) and JSON metadata (`contract.json`).
*   We run `npx prisma db init` to introspect and apply schema definitions as migrations to the PostgreSQL instance.

---

## Step 4: Express API skeleton & Auth (Google OAuth)
We set up authentication routes and session management in Express.
*   **Libraries**: Installed `passport`, `passport-google-oauth20`, and `express-session`.
*   **Dual Mode Setup**: Designed the Passport configuration to dynamically check for Google credentials:
    - **Production/Real Flow**: If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are supplied in `.env`, the system registers `GoogleStrategy` for real Google login.
    - **Development/Evaluation Flow**: If credentials are missing, the system gracefully prints a warning and uses a Mock Auth Bypass (`/auth/mock-login`) that finds/creates a developer profile in the DB and signs them in instantly.
*   **Session Management**: Configured cookie-based sessions with Express Session, exposing routes for:
    - `GET /auth/google` (Sign-in redirection)
    - `GET /auth/google/callback` (OAuth callback)
    - `GET /auth/mock-login` (Developer auth bypass)
    - `GET /auth/me` (Profile retrieval)
    - `POST /auth/logout` (Session teardown)

---

## Step 5: Schedule API (Producer) & BullMQ Setup
We set up the background job queue (BullMQ) and the campaign scheduling endpoints.
*   **Libraries**: Installed `bullmq` and `ioredis`.
*   **Queue Utility**: Created `src/services/queue.service.ts` which exports the Redis connection and a BullMQ `Queue` instance (`emailQueue`).
*   **Campaign Endpoint**: Implemented `POST /emails/schedule`:
    - Validates fields, verifies that the Ethereal sender profile belongs to the authenticated user.
    - Creates a `Campaign` record.
    - For each recipient (lead), calculates the sequential spacing: `startTime + index * delayBetweenEmailsSec`.
    - Creates an `Email` record with status `scheduled` and enqueues a delayed BullMQ job with `jobId = email.id` (enforcing idempotency at the queue level!).
*   **Listing Endpoints**: Exposed `GET /emails/scheduled` and `GET /emails/sent` to retrieve running queue statistics and email logs from the DB.
*   **Sender Management**: Added `GET /senders` (auto-generating a default Ethereal identity if none exist) and `POST /senders`.

---

## Step 6 & 7: BullMQ Worker & Rate-Limiting
We implemented the background consumer process and hourly throughput limits.
*   **Libraries**: Installed `nodemailer` and `@types/nodemailer`.
*   **Nodemailer & Ethereal SMTP Integration**: In `src/services/worker.service.ts`, we set up `getTransporter(sender)`:
    - If default mock credentials are used, we dynamically request a real Ethereal SMTP account using `nodemailer.createTestAccount()`. This guarantees the scheduler works out-of-the-box in local development.
    - Otherwise, it uses the sender's specific Ethereal credentials.
*   **Durable Worker Setup**:
    - Listens on `emailQueue` with a configurable concurrency value.
    - **Idempotency Guard**: Before sending, queries PostgreSQL to confirm the email is still in `scheduled` status. If already processed, it gracefully skips (protects against double-sends on hot restarts).
    - Updates email record in DB to `sent` or `failed` with error details upon completion.
*   **Redis Atomic Rate Limiting**:
    - Checks the sender's configured hourly throughput limit.
    - Tracks hourly usage using Redis key pattern: `rate:{senderId}:{YYYYMMDDHH}`.
    - Atomically increments key on each send attempt using `INCR`. If it's the first send of the hour, sets `EXPIRE` for 3700 seconds.
    - **Reschedule-on-Breach**: If the count exceeds the limit, the worker:
        1. Calculates the time remaining until the next hour.
        2. Updates the database `scheduledTime` for the email to the next hour's start.
        3. Enqueues a new delayed BullMQ job with the calculated delay, preserving the same `jobId` for deduplication.
        4. Triggers a Slack limit-breached notification (exactly once per hour window).

---

## Step 8: Persistence & Restart Testing
We designed and implemented a test suite to prove our restart durability.
*   **Test Script**: Created `src/test-restart.ts` which inserts a mock developer user/sender, schedules a campaign with 5 recipients spaced out 10 seconds apart, writes them to the DB as `scheduled`, and enqueues them as delayed jobs in Redis.
*   **Verification Command**: Added `"test:restart": "tsx src/test-restart.ts"` to `package.json`.
*   **Demonstrated Durability**: 
    - When the test runs, and the server is killed mid-campaign, Redis (configured with AOF persistence) stores all pending delayed jobs.
    - Upon restarting the dev server, the worker resumes immediately: any jobs whose target send times have passed are fired instantly, and future jobs wait for their original delay.
    - Because each job utilizes a database status guard and the deterministic `jobId` deduplication in BullMQ, no email is ever double-sent.

---

## Step 9: Elasticsearch Indexing & Search API
We integrated Elasticsearch to enable full-text searching across all email logs.
*   **Libraries**: Installed `@elastic/elasticsearch`.
*   **Elasticsearch Service**: Created `src/services/elasticsearch.service.ts` which exports:
    - `initializeElasticsearch()`: Connects to the local ES instance and sets up the index `emails_index` with custom mappings (defining types like `keyword` and `text` for `recipient`, `subject`, `body`, `status`, and `user_id`).
    - `indexEmail(...)`: Indexes or updates email logs using database email ID as document ID for deduplication.
    - `searchEmails(userId, searchPhrase)`: Performs a fuzzy (`AUTO`) multi-field search (`recipient`, `subject`, `body`, `sender`) matching the search phrase, strictly filtered/scoped to the user's `userId`.
*   **Sync Flow**:
    - **Initial State**: During campaign scheduling (`POST /emails/schedule`), each email is indexed with status `scheduled`.
    - **Worker Execution**: When the worker successfully sends an email (status `sent`) or fails (status `failed`), it immediately updates the document in Elasticsearch.
*   **Search Router**: Exposed a `GET /emails/search?q=query` endpoint that queries Elasticsearch and returns matching logs.

---

## Step 10: Slack Integration
We implemented Slack OAuth and Webhook integrations to report rate limit breaches instantly.
*   **Dual Mode Setup**:
    - **Production OAuth Flow**: Exposes `/slack/oauth/start` and `/slack/oauth/callback` to negotiate and store real Slack incoming webhooks.
    - **Development/Evaluation Flow**: If `SLACK_CLIENT_ID` is missing, `/slack/oauth/start` redirects to `/slack/mock-callback` which registers a mock webhook (using `SLACK_WEBHOOK_URL` from `.env` if provided, or falling back to a dummy URL).
*   **Manual Override**: Exposed a `POST /slack/connect-webhook` endpoint to let a developer manually connect a real Slack webhook URL without setting up an OAuth App.
*   **Alert Mechanism**: When a sender breaches their hourly rate limit, the background worker checks the database for an active integration and POSTs a formatted notification to the webhook URL.

---

## Step 11 & 12: Frontend Scaffolding, Custom Pages & API Integration
We built a React.js + TypeScript + Tailwind CSS frontend application reflecting the exact design layouts generated by Google Stitch.
*   **Vite Scaffolding**: Initialized React inside the `frontend/` directory, configured routing with `react-router-dom`, and set up Tailwind CSS v3 for config options compatibility.
*   **Custom Tailwind Design Specs**: Embedded all Google Stitch custom color codes (e.g. `surface-container-lowest`, `badge-green`, `nav-active`), spacing variables, border radius declarations, and typography configurations inside `tailwind.config.js`.
*   **Client-Server Request Service**: Built `src/services/api.ts` making fetch calls to the Express API on port `5000` with `credentials: 'include'` to pass session cookies automatically.
*   **Modular Views**:
    - **`Login.tsx`**: Login portal linking Google OAuth redirect (`/auth/google`) and developer email mock bypass routes.
    - **`Scheduled.tsx`**: Scheduled campaigns dashboard showing target recipients, space times, and subject snippets. Integrates Elasticsearch real-time fuzzy search queries.
    - **`Sent.tsx`**: sent/failed logs listing page displaying status badges.
    - **`Detail.tsx`**: Detailed view displaying subject thread header, sender letter avatars, formatted HTML email content, attachments, and failed SMTP error banners.
    - **`Compose.tsx`**: Composing card layout supporting recipient chips inputs, CSV/TXT file lead listings upload, campaign start date-time config sliders, delay spacing inputs, and hourly limits.
    - **`Senders.tsx`**: Senders management board enabling the addition of multiple SMTP sender profiles.
    - **`Slack.tsx`**: Slack settings control enabling live OAuth connection triggers and manual webhook integration overrides.








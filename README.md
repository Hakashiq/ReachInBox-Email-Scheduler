# ReachInbox Email Job Scheduler

A production-grade, distributed email campaign scheduler and rate-limiter built with Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, Elasticsearch, and React.

---

## 🛠️ System Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Frontend Client (React/Vite)"]
        UI["Compose & Campaign UI"]
        Dashboard["Monitoring Dashboard"]
    end

    subgraph API ["API Server (Express)"]
        Routes["HTTP Router"]
        Passport["Google OAuth / Basic Auth"]
        Scheduler["Job Scheduler Service"]
    end

    subgraph Queue ["Queue / Cache Layer (Redis)"]
        BullQueue["BullMQ 'emailQueue'"]
        RateLimits["Rate Limit Counters"]
    end

    subgraph Storage ["Persistent Storage"]
        Postgres[("PostgreSQL DB (Source of Truth)")]
        ES[("Elasticsearch (Search Index)")]
    end

    subgraph Worker ["Background Worker (BullMQ)"]
        Processor["Worker Processor"]
        Mailer["SMTP Transporter (Ethereal)"]
    end

    subgraph Integration ["External Notifications"]
        Slack["Slack Webhook Endpoint"]
    end

    %% Client Interactions
    UI -->|1. Submit Campaign| Routes
    Dashboard -->|Read Stats / Sent Logs| Routes
    
    %% API Actions
    Routes -->|Authenticate| Passport
    Routes -->|2. Save State| Postgres
    Routes -->|3. Index Campaign| ES
    Routes -->|4. Add Delayed Jobs| BullQueue
    
    %% Worker Processing
    Processor -->|5. Fetch Job| BullQueue
    Processor -->|6. Check Rate Limit| RateLimits
    Processor -->|7. Send SMTP Mail| Mailer
    Processor -->|8. Update Status| Postgres
    Processor -->|9. Sync Search Index| ES
    Processor -->|10. Send Notification (Breach)| Slack
```

### 1. How Email Scheduling Works
*   **PostgreSQL Persistence**: When a campaign is submitted via the UI, a parent `Campaign` record is created, and individual recipient `Email` records are pre-generated with `status = "scheduled"` and a target `scheduledTime`.
*   **BullMQ Delayed Jobs**: For every email, a delayed job is enqueued in BullMQ (`emailQueue`) with `delay = Math.max(0, targetTime - Date.now())` and `jobId = emailRecord.id` to ensure deterministic deduplication.
*   **Worker Execution**: When the delay expires, Redis moves the job to the `waiting` list, and an active BullMQ worker thread processes the job.

### 2. How Persistence on Server Restarts is Handled
*   **Redis/PostgreSQL Coherence**: BullMQ delayed jobs are persisted in Redis. If the backend API process crashes or restarts, the Redis queues remain intact.
*   **State Reconstruction**: When the backend server boots up, the worker reconnects to Redis and immediately picks up processing where it left off.
*   **Zero Loss**: Because PostgreSQL remains the source of truth, any discrepancy is recoverable, and jobs scheduled for the future execute at their intended times without duplicate delivery.

### 3. How Rate Limiting & Concurrency are Implemented
*   **Redis-Backed Counter**: Rate limiting is tracked in Redis using hourly buckets (`rate:${senderId}:${hourBucket}`) with a 1-hour Time-To-Live (TTL).
*   **Atomic Increment**: The worker performs an atomic `INCR` operation on the bucket key. If the count exceeds the sender's limit (`sender.maxEmailsPerHour`) or the campaign limit, the limit is breached.
*   **Dynamic Rescheduling**: When a breach occurs:
    1.  The next available hour window is calculated dynamically.
    2.  The `Email` record in PostgreSQL is updated with the new `scheduledTime`.
    3.  A new delayed job is enqueued in BullMQ representing the new slot.
*   **Concurrency Safety**: With `Redis` performing atomic operations and BullMQ managing distributed locks, multiple workers can run concurrently without race conditions or duplicate sends.

---

## ⚡ Features Implemented

### Backend Core
*   **Express & TypeScript**: Strongly typed endpoints and robust error handling.
*   **Relational Persistence**: PostgreSQL schema definitions using Prisma Next with strict indexes on keys.
*   **BullMQ Worker**: Decoupled worker process with concurrency config.
*   **Distributed Rate Limiting**: Redis-backed atomic throughput limiter that reschedules overflow jobs dynamically.
*   **Elasticsearch Sync**: Automatically indexes scheduled and sent email documents to support instant full-text searches.
*   **Slack Webhook Integration**: Auto-notifies connected Slack workspaces with rich markdown alert cards on rate breaches.
*   **Bull Board**: Integrated administrative queue dashboard exposing real-time BullMQ job visibility.

### Frontend Client
*   **Composer Dashboard**: Parse bulk lead files (CSV/TXT), validate lists, choose sender profiles, schedule dates, configure delays, and adjust campaign limits.
*   **Scheduled Page**: Lists upcoming sends with exact dates, times, and day-of-week info.
*   **Sent Logs**: Lists historical deliveries, complete with status tags, previews, and inline Ethereal Preview Inbox sandbox links.
*   **Settings Drawer**: Toggles real-time Slack incoming webhook credentials and handles OAuth-based logout.
*   **Strict Security**: Enforces Google OAuth routing, rendering dashboards for verified accounts and redirection locks for guest visitors.

---

## 🚀 Setup & Installation

### Prerequisites
*   [Node.js (v18+)](https://nodejs.org/)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd ReachInBox Email-Scheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### Step 2: Spin Up Infrastructure Containers
Use the provided `docker-compose.yml` to spin up PostgreSQL, Redis, and Elasticsearch:

```bash
cd ..
docker-compose up -d
```

Verify that all three containers are active:
*   **PostgreSQL**: `localhost:5432`
*   **Redis**: `localhost:6379`
*   **Elasticsearch**: `localhost:9200`

---

### Step 3: Configure Environment Variables

#### Backend Configuration
Create [**`backend/.env`**](file:///D:/antigravity/ReachInBox%20Email-Scheduler/backend/.env):

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_NODE=http://localhost:9200
FRONTEND_URL=http://localhost:5173
DEFAULT_HOURLY_LIMIT=100
QUEUE_CONCURRENCY=5

# Google OAuth Credentials (Retrieve from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Basic Authentication credentials for BullMQ Dashboard
ADMIN_USER=admin
ADMIN_PASS=your-admin-password
SESSION_SECRET=your-session-secret-key
```

#### Frontend Configuration
Create [**`frontend/.env`**](file:///D:/antigravity/ReachInBox%20Email-Scheduler/frontend/.env):

```env
VITE_API_URL=http://localhost:5000
```

---

### Step 4: Sync the Database Schema
Deploy the database schema mappings and compile TypeScript interfaces:

```bash
cd backend
npm run contract:emit
npx prisma db update
```

---

### Step 5: Start the Development Servers

#### Start Backend (API + Worker)
```bash
cd backend
npm run dev
```

#### Start Frontend (Vite Client)
```bash
cd frontend
npm run dev
```

The application is now accessible at:
*   **Frontend Dashboard**: `http://localhost:5173`
*   **Backend Server**: `http://localhost:5000`
*   **BullMQ Board**: `http://localhost:5000/admin/queues` *(Log in using `ADMIN_USER` and `ADMIN_PASS` configured in your `.env`)*

---

## 🧪 Running Automated Tests

A comprehensive integration test suite verifies the rate-limiter, scheduling delays, Ethereal mailer handshakes, Slack triggers, and Elasticsearch search counts:

```bash
cd backend
npm run test:backend
```

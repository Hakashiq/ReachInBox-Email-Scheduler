# ReachInbox Email Job Scheduler — Design Decisions & Trade-offs

This document outlines the major architectural and design trade-offs made during the implementation of the scheduler.

---

## 1. Scheduling: BullMQ vs. Custom Database Polling
When building an email scheduler, there are two primary architectures:
1.  **Database Polling**: Running a recurring loop (e.g. every 5 seconds) to query the database: `SELECT * FROM emails WHERE status = 'scheduled' AND scheduled_time <= NOW()`.
2.  **Durable Job Queue (BullMQ)**: Enqueuing delayed jobs into a memory-efficient store (Redis) and letting worker threads consume them as they expire.

### Decisions & Trade-offs
*   **Why BullMQ was chosen**: Database polling is highly resource-intensive, does not scale well to high concurrency, and results in excessive DB read load. BullMQ utilizes Redis sorted sets (`ZSET`) to store delayed jobs. When a delay expires, Redis pushes the job to the active queue. This is lightweight, fast, and eliminates unnecessary database traffic.
*   **Data Consistency**: The downside of BullMQ is that queue state is stored in Redis, while campaign metadata is stored in PostgreSQL. To ensure database/queue alignment, we use **idempotency checks**. Before sending, the worker queries PostgreSQL to confirm the status is still `scheduled`. This prevents double-sends even if a job is enqueued twice.

---

## 2. SMTP: Ethereal (Fake SMTP) vs. Production SMTP Providers
*   **Decision**: We configured the mail transporter using **Ethereal SMTP**. Ethereal captures all outbound traffic and generates preview URLs.
*   **Trade-off**: While this prevents the scheduler from sending emails to real-world inboxes, it is perfect for evaluation because it requires zero API keys or monthly subscriptions, and allows the hiring team to inspect sent email payloads instantly via the logs' preview links.
*   **Unique Enhancement**: Since hardcoded Ethereal credentials frequently expire, our worker dynamically generates a new Ethereal user account via `nodemailer.createTestAccount()` on startup if mock settings are active. This guarantees the mail server remains functional without manual configuration updates.

---

## 3. Rate-Limiting: Rescheduling vs. Dropping
When a sender hits their hourly throughput limit:
*   **Rescheduling Choice**: Rather than failing the campaign or dropping the emails, we calculate the time remaining until the next hour and reschedule the jobs with that delay.
*   **Order Preservation**: Because BullMQ queues are FIFO-ordered and we calculate delays sequentially, emails are delayed into the next window while preserving their relative compose order.

---

## 4. Search: Elasticsearch vs. PostgreSQL Full-Text Search
*   **Why Elasticsearch was chosen**: While Postgres offers text matching, indexing HTML email bodies and searching them concurrently under high workloads can cause substantial query lag. Elasticsearch handles tokenization, fuzzy search, and scoring out-of-the-box.
*   **Sync Cost**: Pushing to Elasticsearch requires an extra network request on every status transition (scheduled, sent, failed). We implemented this asynchronously within the worker thread to prevent blocking main database updates.

# ReachInbox Email Job Scheduler — Key Concepts

This document contains conceptual deep dives into the core technologies used in this project.

---

## 1. BullMQ & Redis Internals
BullMQ is a popular Node.js library for managing queues and message processing. It is backed entirely by Redis.

### How Delayed Jobs Work
1.  When you schedule a job with a `delay` (in milliseconds), BullMQ does not put the job directly into the active list. Instead, it adds the job to a Redis **Sorted Set** (`ZSET`) called `bull:emailQueue:delayed`.
2.  The score of each item in the sorted set is set to `Timestamp + Delay`.
3.  Redis continuously monitors this sorted set. When the current time passes the item's score, BullMQ runs a Lua script that moves the job from the delayed set to the active list (`bull:emailQueue:wait`), notifying any active workers.
4.  This Lua-script-based movement is **atomic**, ensuring that even if multiple workers are running, only one worker pulls the job.

---

## 2. Redis Atomic Counter Rate-Limiting
Under concurrent load, simple database updates like `COUNT(*)` can suffer from **race conditions**. If two workers check the count simultaneously, they might both see `count = 9` (under a limit of 10), and both proceed to send, breaching the limit.

To prevent this, we use Redis atomic operations:
*   `INCR rate:{senderId}:{hourBucket}`: Increments the counter and returns the new value. Because Redis is single-threaded, this operation is completely atomic. No two workers can retrieve the same incremental value.
*   `EXPIRE key 3700`: If the increment returns `1`, we know it is the first request of this hour window. We immediately set an expiration of just over 1 hour. This ensures Redis memory is cleaned up automatically, without requiring background cleanup crons.

---

## 3. Google & Slack OAuth 2.0 Flow
OAuth 2.0 is the industry-standard protocol for authorization.

### Code Exchange Sequence
```
┌──────────┐          ┌──────────────┐          ┌───────────────┐
│ Frontend │          │ Express API  │          │ OAuth Server  │
└────┬─────┘          └──────┬───────┘          └───────┬───────┘
     │   Click Login         │                          │
     ├──────────────────────>│                          │
     │                       │   Redirect with ClientID │
     │                       ├─────────────────────────>│
     │                       │                          │  User Approves
     │                       │<─────────────────────────┤
     │                       │   Auth Code returned     │
     │   Callback with Code  │                          │
     │<──────────────────────┤                          │
     │                       │                          │
     │   Exchange Code       │                          │
     ├──────────────────────>│   POST Code + Secret     │
     │                       ├─────────────────────────>│
     │                       │                          │  Token Returned
     │                       │<─────────────────────────┤
     │                       │                          │
```

1.  The client requests the OAuth server.
2.  The OAuth server redirects back to our `callback` route with a temporary `code`.
3.  Our Express backend exchanges this `code` alongside our `Client Secret` for an `access_token`. This exchange is safe because the secret is never exposed to the frontend.

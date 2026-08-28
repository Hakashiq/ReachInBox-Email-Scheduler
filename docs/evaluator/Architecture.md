# ReachInbox Email Job Scheduler — Architecture & Database Schema

This document details the system design, database schemas, and service layouts of the scheduler.

## Service Infrastructure (Docker)
The system depends on three main services defined in the [`docker-compose.yml`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/docker-compose.yml):
*   **PostgreSQL 15**: Port `5432` — Source of truth for users, senders, campaigns, and email execution logs.
*   **Redis 7**: Port `6379` — BullMQ queue broker and rate-limiting atomic counters store. Durability is enforced via `appendonly yes` configuration.
*   **Elasticsearch 8.11.1**: Port `9200` — Email indexing for advanced search functionality.

## Relational Database Schema
Managed via Prisma Next. Below is the relational mapping of the entities defined in [`contract.prisma`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/backend/src/prisma/contract.prisma).

### `User`
Stores authenticated users of the dashboard.
*   `id` (UUID, Primary Key)
*   `googleId` (String, Unique)
*   `name` (String)
*   `email` (String, Unique)
*   `avatarUrl` (String)
*   `createdAt` (TimestamptzString)

### `Sender` (Tenants)
Configured Ethereal SMTP identities belonging to a user.
*   `id` (UUID, Primary Key)
*   `userId` (UUID, Foreign Key User)
*   `name` (String) — Display name
*   `smtpUser` (String)
*   `smtpPass` (String) — Encrypted SMTP password
*   `maxEmailsPerHour` (Int, Nullable) — Override limit
*   `createdAt` (TimestamptzString)

### `Campaign`
Represents an email blast composed and scheduled by a user.
*   `id` (UUID, Primary Key)
*   `userId` (UUID, Foreign Key User)
*   `senderId` (UUID, Foreign Key Sender)
*   `subject` (String)
*   `body` (String)
*   `startTime` (TimestamptzString)
*   `delayBetweenEmailsSec` (Int)
*   `hourlyLimit` (Int)
*   `createdAt` (TimestamptzString)

### `Email`
Individual recipient email jobs.
*   `id` (UUID, Primary Key) — Matches BullMQ `jobId` for idempotency
*   `campaignId` (UUID, Foreign Key Campaign)
*   `recipientEmail` (String)
*   `status` (Enum: `scheduled`, `sent`, `failed`)
*   `scheduledTime` (TimestamptzString)
*   `sentTime` (TimestamptzString, Nullable)
*   `errorMessage` (String, Nullable)
*   `retryCount` (Int, Default 0)
*   `createdAt` (TimestamptzString)
*   `updatedAt` (TimestamptzString)

### `SlackIntegration`
OAuth webhook configuration for rate limit notifications.
*   `id` (UUID, Primary Key)
*   `userId` (UUID, Foreign Key User)
*   `accessToken` (String)
*   `webhookUrl` (String)
*   `connectedAt` (TimestamptzString)
*   `isActive` (Boolean)

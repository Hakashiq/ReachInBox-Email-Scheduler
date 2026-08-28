# ReachInbox Email Job Scheduler — Troubleshooting Guide

Here are common issues you may encounter during development and how to solve them.

---

## 1. Docker Daemon Connection Issues
**Error**: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine...`

### Causes
1.  Docker Desktop is installed but not currently running.
2.  The Docker background service has stopped.

### Resolution
*   Run the background process manually:
    ```powershell
    Start-Process "C:\Users\Dell\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    ```
*   Alternatively, execute our custom backend daemon wrapper (located in the resources folder or launched via agent).
*   Wait 20-30 seconds, then check status using:
    ```bash
    docker info
    ```

---

## 2. Elasticsearch Heap Limit Crash
**Error**: Container `reachinbox_elasticsearch` starts up but exits after a few seconds with code `137` (Out of Memory).

### Cause
Elasticsearch is highly memory-intensive. By default, it allocates up to 1GB or 2GB of RAM, which may exceed your system's limit.

### Resolution
We have configured `ES_JAVA_OPTS=-Xms512m -Xmx512m` in the `docker-compose.yml` to limit memory allocation. If it still crashes:
1.  Open `docker-compose.yml`.
2.  Reduce limits to `256m`:
    ```yaml
    environment:
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
    ```
3.  Restart containers:
    ```bash
    docker compose down && docker compose up -d
    ```

---

## 3. BullMQ "MaxRetriesPerRequest" Error
**Error**: `Error: Redis connection has been closed. maxRetriesPerRequest option must be set to null.`

### Cause
BullMQ blocks connections when retrieving jobs from Redis streams. If a standard Redis connection has a retry limit set, it conflicts with BullMQ.

### Resolution
When initializing your `IORedis` connection for BullMQ, you **must** supply `maxRetriesPerRequest: null`:
```typescript
const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Critical for BullMQ!
});
```
We have already handled this correctly in [`queue.service.ts`](file:///D:/antigravity/ReachInBox%20Email-Scheduler/backend/src/services/queue.service.ts).

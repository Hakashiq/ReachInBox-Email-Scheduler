# ReachInbox Email Scheduler - Demo Video Recording Guide & Script

Use this step-by-step script and guide to record your 5-minute project demonstration video.

---

## 🛠️ Step-by-Step Local Environment Setup

### Step 1: Start your Docker Containers (Postgres, Redis, Elasticsearch)
Make sure Docker Desktop is running on your machine, then open your terminal at the project root (`ReachInBox Email-Scheduler`) and run:
```powershell
docker-compose up -d
```
*Verify they are healthy:*
```powershell
docker ps
```

### Step 2: Initialize & Sync the Database
Open a new terminal inside the `/backend` directory and run:
```powershell
cd backend
npm install
npx prisma contract emit
npx prisma db update
```

### Step 3: Start the Backend (API + Background Worker)
Inside the `/backend` directory terminal, start your backend server:
```powershell
npm run dev
```
*(This starts the Express server and the background BullMQ email worker automatically.)*

### Step 4: Start the Frontend Client
Open another terminal window, navigate to the `/frontend` directory, and run:
```powershell
cd frontend
npm install
npm run dev
```
*(This will boot up the React + Vite developer server and display a URL like `http://localhost:5173`.)*

### Step 5: Start the Demo Recording!
1.  **Open the App**: Go to `http://localhost:5173` in your browser.
2.  **Verify Queue Monitor**: Go to `http://localhost:5000/admin/queues` (it will open instantly with zero passwords required!).
3.  **Compose & Record**: Follow our storyboard guide to schedule, show the yellow rescheduled logs, and view your completed/delayed jobs in the Bull Board!

---

## ⏱️ Video Timeline Overview
*   **Part 0: Terminal Setup & Launch** (0:00 - 0:45)
*   **Part 1: Login Page & Dual-Mode Bypass** (0:45 - 1:30)
*   **Part 2: Local Architecture & Queue Monitor** (1:30 - 2:15)
*   **Part 3: Composing & Scheduling** (2:15 - 3:00)
*   **Part 4: Restart Resiliency Demonstration** (3:00 - 4:00)
*   **Part 5: Rate Limiting & Queue Visualization** (4:00 - 5:00)

---

## 🎬 Section-by-Section Script

### Part 0: Terminal Setup & Launch (0:00 - 0:45)
*   **Visual**: Show your screen with terminal windows open:
    *   *Terminal 1*: Showing Docker containers running (`docker-compose up -d`).
    *   *Terminal 2*: Showing the backend starting up (`npm run dev`) and outputting database/Redis connection logs.
    *   *Terminal 3*: Showing the Vite frontend launching (`npm run dev`).
*   **Voiceover Script**:
    > *"Hi! Before we look at the UI, let's look at how the application is set up. We spin up our local database services — PostgreSQL, Redis, and Elasticsearch — using a simple Docker Compose file. Next, we start our Express API server and background worker in our backend terminal, and boot up our Vite React development server in the frontend. Everything is now connected and running locally."*

---

### Part 1: Login Page & Dual-Mode Bypass (0:45 - 1:30)
*   **Visual**: Switch to your browser showing the Login page (`http://localhost:5173/login`).
*   **Voiceover Script**:
    > *"We are now looking at the main login screen. The application supports standard Google OAuth for secure user authentication. However, to make evaluation simple for interviewers, we built a **Dual-Mode Bypass**. If no client credentials are configured in the environment, clicking this login button redirects us instantly to a mock dashboard profile without needing to configure Google Developer keys."*
*   **Action**: Click the login button and watch it transition smoothly to the main Dashboard page.

---

### Part 2: Local Architecture & Queue Monitor (1:30 - 2:15)
*   **Visual**: Click on the **Queue Monitor** link in the sidebar (it opens `http://localhost:5000/admin/queues` in a new tab showing Bull Board).
*   **Voiceover Script**:
    > *"Now that we are inside the dashboard, let's look at the background queue infrastructure. By clicking 'Queue Monitor' in our sidebar, we can instantly access our BullMQ dashboard. As you can see, the queue is currently empty and clean, ready to process incoming jobs."*

---

### Part 3: Composing & Scheduling (2:15 - 3:00)
*   **Visual**: Navigate back to the frontend, click **Compose**.
    *   Enter or upload 30 lead emails.
    *   Set the **Delay** to `2` seconds and **Limit** to `10` emails per hour.
    *   Type a subject and body text.
    *   Open the schedule panel, select a time 1 minute in the future, click the **OK** button to confirm, and click **Schedule Campaign** at the top.
*   **Voiceover Script**:
    > *"Let's compose a new campaign. I will schedule it to send 30 emails, set a spacing delay of 2 seconds, and set our hourly rate limit to 10. Using the scheduler drawer, I'll set the campaign to start in one minute, confirm with our OK button, and schedule it."*

---

### Part 4: Restart Resiliency Demonstration (3:00 - 4:00)
*   **Visual**:
    1.  Show the emails listed in the **Scheduled** tab.
    2.  Open your backend terminal and press **`Ctrl + C`** to stop the backend server.
    3.  Restart the backend server (`npm start` or `npm run dev`).
    4.  Wait for the scheduled time to pass. Refresh the page to show that the worker successfully wakes up and begins sending the emails.
*   **Voiceover Script**:
    > *"To show that our schedule is completely resilient to crashes, I will stop our backend server. Our campaign data is safely stored in PostgreSQL and Redis. Now, I will restart the server. Once back online, the worker picks up the scheduled jobs exactly where it left off, and begins sending the emails right on schedule."*

---

### Part 5: Rate Limiting & Queue Visualization (4:00 - 5:00)
*   **Visual**:
    1.  Go to the **Sent** tab to show the first 10 emails are sent, featuring Ethereal preview links.
    2.  Go to the **Scheduled** tab to show the remaining 20 emails have turned **yellow** with the `- Rescheduled (Rate Limit) -` label.
    3.  Go to the **Queue Monitor** tab to show:
        *   **COMPLETED**: `10` jobs visible.
        *   **DELAYED**: `20` jobs visible (automatically scheduled to the start of the next local hour).
    4.  Show your Slack channel displaying the instant **Rate Limit Exceeded** card alert.
*   **Voiceover Script**:
    > *"Finally, let's see how our rate limiting behaves under load. Since our limit was set to 10, the first 10 emails were sent successfully and now appear in the 'Completed' tab in our Queue Monitor. The remaining 20 emails breached the limit, so they were automatically rescheduled to the start of the next hour, turning yellow on our dashboard. They are now waiting in our 'Delayed' queue. We also received a structured Rate Limit alert card instantly on Slack. Everything works perfectly!"*

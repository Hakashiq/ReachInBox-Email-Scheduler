# ReachInbox Email Job Scheduler — Local Testing Scenarios

This document shows you how to trigger and test every key feature of the backend scheduler.

---

## 1. Google OAuth Mock Bypass
If you do not have Google Developer keys:
1.  Open your browser and navigate to: `http://localhost:5000/auth/google`.
2.  The backend will detect the missing environment variables, print a warning in the console, and redirect you to `http://localhost:5000/auth/mock-login`.
3.  The mock handler logs you in as `dev@reachinbox.com` and redirects you to the frontend.
4.  Navigate to `http://localhost:5000/auth/me` to verify your session contains user info:
    ```json
    {
      "user": {
        "id": "c269021e-6703-44f9-92dc-55d30635b3b7",
        "email": "dev@reachinbox.com",
        "name": "Developer User"
      }
    }
    ```

---

## 2. Triggering SMTP Sends (Ethereal)
When campaigns are processed, emails are pushed to Ethereal SMTP.
1.  Schedule a campaign.
2.  Watch the backend console.
3.  Nodemailer prints a **Preview URL**:
    `[Worker] Ethereal Preview URL: https://ethereal.email/message/Y2pL8tW9Rz1S8K3aAAAAATb-G3eK1Q`
4.  Copy and paste the URL into your browser to view the fully rendered HTML email and verify headers!

---

## 3. Testing Rate-Limiting & Rescheduling
To test that rate limiting and rescheduling work correctly without having to wait an hour:
1.  Open your Postgres database (or via Prisma Studio `npx prisma studio` / database manager).
2.  Create a sender profile, and set `maxEmailsPerHour` to a low number (e.g. `2`).
3.  Compose and schedule a campaign containing **5 leads** with a small delay (e.g. 5 seconds).
4.  The worker will send the first 2 emails successfully.
5.  On the 3rd email, the worker will output:
    `[Worker] Rate limit breached for sender Test Sender (3/2). Rescheduling job...`
6.  Query `/emails/scheduled` inside your browser. You will see that the remaining 3 emails have had their target `scheduledTime` rescheduled to the start of the next hour!

---

## 4. Testing Slack Webhook Alerts
To test live Slack alerts:
1.  Create a test Slack workspace and generate an **Incoming Webhook URL** (e.g. `https://hooks.slack.com/services/...`).
2.  Make a POST request to `/slack/connect-webhook` with your webhook:
    ```json
    {
      "webhookUrl": "https://hooks.slack.com/services/YOUR/REAL/WEBHOOK"
    }
    ```
3.  Trigger a rate-limit breach (using the steps in the section above).
4.  Verify that your Slack channel receives a live alert detailing the sender limit breach instantly!

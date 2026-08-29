# ReachInbox Email Scheduler - Railway Deployment Guide

This guide provides step-by-step instructions to deploy the backend, PostgreSQL database, and Redis cache of the ReachInbox Email Scheduler to **Railway**, which is a powerful, user-friendly hosting alternative.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Create a Railway Project](#step-1-create-a-railway-project)
3. [Step 2: Add a PostgreSQL Database Service](#step-2-add-a-postgresql-database-service)
4. [Step 3: Add a Redis Cache Service](#step-3-add-a-redis-cache-service)
5. [Step 4: Deploy the Backend API Service](#step-4-deploy-the-backend-api-service)
6. [Step 5: Connect Frontend (Vercel) to Railway](#step-5-connect-frontend-vercel-to-railway)

---

## 1. Prerequisites
* A [GitHub account](https://github.com/) containing your project repository.
* A [Railway account](https://railway.app/) (connected to your GitHub account).
* A free sandbox Elasticsearch URL from [Bonsai.io](https://bonsai.io/) or [Elastic Cloud](https://www.elastic.co/cloud/).

---

## Step 1: Create a Railway Project
1. Log in to [Railway](https://railway.app/).
2. Click **New Project** in the upper right.
3. Select **Empty Project**. This will create a fresh, clean workspace environment for your services.

---

## Step 2: Add a PostgreSQL Database Service
1. Inside your new empty project workspace, click **+ Add Service** or press `Cmd/Ctrl + K`.
2. Select **Database** -> **Add PostgreSQL**.
3. Railway will provision a PostgreSQL instance.
4. Click on the newly created **PostgreSQL** card, go to the **Variables** tab, and you will see the database variables (like `DATABASE_URL`) are automatically configured.

---

## Step 3: Add a Redis Cache Service
1. In your project workspace, click **+ Add Service** or press `Cmd/Ctrl + K`.
2. Select **Database** -> **Add Redis**.
3. Railway will spin up a Redis instance.
4. Click on the **Redis** card, go to the **Variables** tab, and copy the **`REDIS_URL`** connection string (e.g., `redis://default:token@host:port`).

---

## Step 4: Deploy the Backend API Service
1. Click **+ Add Service** -> **GitHub Repo**.
2. Select your repository.
3. Click on the newly added service card, go to **Settings**, and configure:
   * **Root Directory**: Set to `backend` (to tell Railway where the Express backend resides).
   * **Build Command**: Set to `npm install && npm run contract:emit && npm run build`
   * **Start Command**: Set to `npm start`
4. Go to the **Variables** tab of the service and click **New Variable** (or **Raw Editor** to paste):
   * `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (This links your Railway PostgreSQL instance variables automatically!)
   * `REDIS_URL` = `${{Redis.REDIS_URL}}` (This links your Railway Redis instance variables automatically!)
   * `ELASTICSEARCH_NODE` = (Paste your Bonsai.io or Elastic Cloud URL)
   * `NODE_ENV` = `production`
   * `PORT` = `5000`
   * `DEFAULT_HOURLY_LIMIT` = `100`
   * `QUEUE_CONCURRENCY` = `5`
   * `ADMIN_USER` = `admin`
   * `ADMIN_PASS` = `your-admin-password`
   * `SESSION_SECRET` = `your-session-secret-key`
   * `FRONTEND_URL` = (Your Vercel static client URL, e.g., `https://your-app.vercel.app`)
5. Railway will automatically trigger a build. Once the deployment log outputs `Server is running on port 5000`, go to **Settings** and click **Generate Domain** under the **Networking** section to expose your backend API publicly.
6. Copy the generated URL (e.g., `https://backend-production-xxxx.up.railway.app`).

---

## Step 5: Connect Frontend (Vercel) to Railway
To host your frontend client on Vercel for free:
1. Log in to [Vercel](https://vercel.com/) and import your project.
2. Select the `frontend` folder as root directory.
3. Set the build parameters: Preset: `Vite`, Output: `dist`.
4. Add the environment variable:
   * `VITE_API_URL` = (Paste your Railway backend URL copied in Step 4)
5. Click **Deploy**. Vercel will output your live URL.
6. Remember to copy this Vercel URL, go to your Railway backend service variables, update the `FRONTEND_URL` variable, and re-deploy.

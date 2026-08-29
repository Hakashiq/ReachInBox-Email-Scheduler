# ReachInbox Email Scheduler - Production Deployment Guide

This guide provides step-by-step instructions to deploy the entire ReachInbox Email Scheduler stack for free using cloud-hosted databases and serverless architectures.

---

## 📋 Table of Contents
1. [PostgreSQL Setup (Supabase)](#1-postgresql-setup-supabase)
2. [Redis Setup (Upstash)](#2-redis-setup-upstash)
3. [Elasticsearch Setup (Bonsai.io)](#3-elasticsearch-setup-bonsaiio)
4. [Backend Server Deployment (Render)](#4-backend-server-deployment-render)
5. [Frontend Client Deployment (Vercel)](#5-frontend-client-deployment-vercel)

---

## 1. PostgreSQL Setup (Supabase)
We will use Supabase for hosting a resilient, free PostgreSQL database.

1. Go to [Supabase](https://supabase.com/) and sign up / log in with GitHub.
2. Click **New Project** and select or create an organization.
3. Enter a Project Name (e.g., `reachinbox-db`) and a secure database password.
4. Select a region close to your target audience.
5. Click **Create new project**. Wait 2–3 minutes for the database instance to provision.
6. Once ready, navigate to **Project Settings** (gear icon in sidebar) -> **Database**.
7. Locate the **Connection string** section, choose **URI**, and copy the connection string.
   * *Example:* `postgresql://postgres.[your-project-ref]:[your-password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
   * **Note:** Replace `[your-password]` with the actual database password you chose.

---

## 2. Redis Setup (Upstash)
We will use Upstash Serverless Redis for BullMQ queue state management and rate-limit counters.

1. Go to [Upstash](https://upstash.com/) and sign up / log in.
2. Click **Create Database**.
3. Set the database name to `reachinbox-queue`.
4. Choose the region matching your Supabase region for minimal latency.
5. Click **Create**.
6. Once created, copy the **Redis Connection URL** from the database console.
   * *Example:* `rediss://default:[your-token]@us1-matching-redis.upstash.io:6379`

---

## 3. Elasticsearch Setup (Bonsai.io)
We will use Bonsai.io for a free Elasticsearch cluster to index emails and support full-text searches.

1. Go to [Bonsai.io](https://bonsai.io/) and sign up.
2. Click **Create Cluster**.
3. Choose **Sandbox (Free)** tier.
4. Set the Cluster Name (e.g., `reachinbox-search`).
5. Select the cloud provider and region close to your other databases.
6. Click **Create Cluster**.
7. Once created, copy the **Access URL** (contains basic authentication credentials).
   * *Example:* `https://[your-api-key]@us-east-1.bonsai.io`

---

## 4. Backend Server Deployment (Render)
We will deploy the Node.js/Express.js backend API and background worker on Render.

1. Go to [Render](https://render.com/) and sign in with GitHub.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   * **Name**: `reachinbox-backend`
   * **Language**: `Node`
   * **Root Directory**: `backend`
   * **Build Command**: `npm install && npm run contract:emit && npm run build`
   * **Start Command**: `npm start`
   * **Instance Type**: Select **Free**
5. Click **Advanced** to add Environment Variables:
   * `NODE_ENV` = `production`
   * `DATABASE_URL` = (Your Supabase PostgreSQL URI copied in Step 1)
   * `REDIS_URL` = (Your Upstash Redis connection URL copied in Step 2)
   * `ELASTICSEARCH_NODE` = (Your Bonsai.io Elasticsearch URL copied in Step 3)
   * `FRONTEND_URL` = `https://your-frontend-app.vercel.app` (You can update this after Vercel deployment)
   * `DEFAULT_HOURLY_LIMIT` = `100`
   * `QUEUE_CONCURRENCY` = `2` (Keep low for Free Tier resources)
   * `ADMIN_USER` = `admin`
   * `ADMIN_PASS` = `your_secure_password`
   * `SESSION_SECRET` = `some_long_random_hash`
6. Click **Create Web Service**. Render will install, compile the contract, build the TypeScript files, and start the server and background worker.
7. Copy the generated Web Service URL (e.g., `https://reachinbox-backend.onrender.com`).

---

## 5. Frontend Client Deployment (Vercel)
We will host the React/Vite client static pages on Vercel.

1. Go to [Vercel](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Edit the framework settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend`
5. Under **Build & Development Settings**, verify the defaults:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
6. Under **Environment Variables**, add:
   * **Key**: `VITE_API_URL`
   * **Value**: (Your Render Web Service URL copied in Step 4)
7. Click **Deploy**. Vercel will build the production static files and provide your live frontend URL (e.g., `https://reachinbox-email-scheduler.vercel.app`).

*Note: Remember to go back to your Render backend environment variables and update the `FRONTEND_URL` variable to match this live Vercel URL, then re-deploy the Render backend to apply CORS updates.*

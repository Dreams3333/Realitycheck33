# Reality Check — Deployment Guide

## Architecture Overview

```
Mobile App (Expo / EAS)
    ↓ HTTPS
Backend API (Railway)  ←→  PostgreSQL (Railway)
    ↓
Admin Dashboard (Vercel)
    ↓
Email Digest (Nodemailer via SendGrid)
```

---

## 1. Backend → Railway

### Setup
1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo → select `reality-check` → set root to `backend/`
3. Add a **PostgreSQL** plugin from the Railway dashboard
4. Railway auto-sets `DATABASE_URL` — no manual config needed

### Environment Variables (Railway → Variables tab)
```
NODE_ENV=production
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from Stripe webhook dashboard
STRIPE_PREMIUM_PRICE_ID=price_... # your $4.99/mo price ID
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG...
EMAIL_FROM=digest@yourdomain.com
ADMIN_SECRET_KEY=<generate a random string>
APP_URL=https://your-app.railway.app
```

### Run Database Migration
After first deploy, open Railway's Shell tab for the service:
```bash
npm run db:migrate
```

### Stripe Webhook
In Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://your-app.railway.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## 2. Admin Dashboard → Vercel

### Setup
1. Create account at [vercel.com](https://vercel.com)
2. New Project → Import `reality-check` repo → set **Root Directory** to `admin/`
3. Framework Preset: **Vite**

### Environment Variables (Vercel → Settings → Environment Variables)
```
VITE_API_URL=https://your-app.railway.app/api
VITE_ADMIN_KEY=<same as ADMIN_SECRET_KEY from Railway>
```

### Deploy
Vercel auto-deploys on every push to main.

---

## 3. Mobile App → EAS Build

### Prerequisites
```bash
npm install -g eas-cli
eas login
```

### Configure app.json
Update `app.json` with your bundle IDs:
```json
{
  "expo": {
    "name": "Reality Check",
    "slug": "reality-check",
    "ios": {
      "bundleIdentifier": "com.yourcompany.realitycheck"
    },
    "android": {
      "package": "com.yourcompany.realitycheck"
    },
    "extra": {
      "eas": { "projectId": "your-eas-project-id" }
    }
  }
}
```

### Set API URL
Create `.env` in project root:
```
EXPO_PUBLIC_API_URL=https://your-app.railway.app/api
```

### Initialize EAS
```bash
eas build:configure
```

### eas.json
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Build for iOS (App Store)
```bash
eas build --platform ios --profile production
```
Then submit:
```bash
eas submit --platform ios
```

### Build for Android (Google Play)
```bash
eas build --platform android --profile production
```
Then submit:
```bash
eas submit --platform android
```

---

## 4. Stripe Setup

1. Create product in Stripe Dashboard: **Reality Check Premium**
2. Add price: $4.99/month (recurring)
3. Copy the `price_xxx` ID → set as `STRIPE_PREMIUM_PRICE_ID`
4. Enable 7-day free trials in the price settings
5. Set up the webhook endpoint as described in section 1

---

## 5. Weekly Digest Cron Job

Railway supports cron jobs natively. Add a cron service:
- Command: `curl -X POST https://your-app.railway.app/api/admin/digest -H "x-admin-key: YOUR_KEY"`
- Schedule: `0 9 * * 1` (every Monday at 9am UTC)

---

## 6. Google Sign-In (Optional Setup)

1. Create project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Sign-In API
3. Create OAuth 2.0 credentials (iOS + Android client IDs)
4. Add `@react-native-google-signin/google-signin` to the mobile app
5. Implement server-side token verification in `backend/src/routes/auth.ts`

---

## 7. Development Setup

### Mobile App
```bash
cd reality-check
npm install
npx expo start
```

### Backend
```bash
cd reality-check/backend
npm install
cp .env.example .env   # fill in values
npm run dev
```

### Admin Dashboard
```bash
cd reality-check/admin
npm install
# create .env.local with VITE_API_URL and VITE_ADMIN_KEY
npm run dev
```

### Local PostgreSQL
```bash
brew install postgresql@16
brew services start postgresql@16
createdb realitycheck
psql realitycheck -f backend/src/db/schema.sql
```

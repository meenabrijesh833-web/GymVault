# GymVault Production Restart Runbook

This document describes the production architecture, provider responsibilities, required configuration, and verification order. Never commit real passwords, API secrets, app passwords, or webhook tokens.

## Current architecture

- Frontend: Vercel, `https://gymvault.tech`
- Backend: Render, `https://gymvault-earv.onrender.com`
- Database: Supabase PostgreSQL through the session pooler
- Platform payments: Razorpay main platform account
- Gym member collections: direct UPI, per-gym manual Razorpay, or Razorpay Route connected accounts
- Transactional email: Zoho Mail SMTP using `team@gymvault.tech`
- WhatsApp: MSG91 plus a Meta-approved WhatsApp Business number and templates

## Authentication flows

### Email/password owner signup

1. Frontend loads `GET /api/auth/config`.
2. Frontend requests `POST /api/auth/signup/send-email-otp`.
3. Backend sends the OTP through configured SMTP.
4. Frontend verifies it through `POST /api/auth/signup/verify-email-otp`.
5. Backend returns an email verification token.
6. Frontend creates the gym and owner through `POST /api/auth/register-owner`.

SMTP is therefore required for production owner signup.

### Email/password login

`POST /api/auth/login` validates the password and returns the owner/staff JWT. This path does not require MSG91.

### Password reset

`POST /api/auth/password-reset/request` sends an email OTP. `POST /api/auth/password-reset/confirm` verifies it and saves the new password. SMTP is required.

### Member portal login

Members are selected by registered phone number, but the OTP is delivered to the member email address. The endpoints are `POST /api/auth/member/profiles`, `POST /api/auth/member/send-otp`, and `POST /api/auth/member/verify-otp`. SMTP is required; the member must have an email address.

### Google OAuth

Google signup and login require a Google OAuth Web client. The exact authorized redirect URI is:

```text
https://gymvault-earv.onrender.com/api/auth/google/callback
```

The authorized JavaScript origin is:

```text
https://gymvault.tech
```

Required Render variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://gymvault-earv.onrender.com/api/auth/google/callback
APP_URL=https://gymvault-earv.onrender.com
FRONTEND_URL=https://gymvault.tech
```

## Render configuration

Build and runtime:

```text
Root directory: repository root
Build command: npm install
Start command: npm run start:render
Node version: 20.18.0
Health path: /healthz
```

Core variables:

```env
NODE_ENV=production
NODE_VERSION=20.18.0
TRUST_PROXY=true
APP_URL=https://gymvault-earv.onrender.com
SERVER_URL=https://gymvault-earv.onrender.com
FRONTEND_URL=https://gymvault.tech
PUBLIC_FRONTEND_URL=https://gymvault.tech
CORS_ORIGIN=https://gymvault.tech

DB_HOST=aws-0-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=<database-password>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
DB_POOL_MAX=25
DB_POOL_MIN=5

JWT_SECRET=<new-long-random-secret>
APP_SECRET_ENC_KEY=<new-long-random-secret>
MASTER_PASSWORD=<new-strong-admin-password>
RUN_DB_INIT_ON_BOOT=true
```

After schema creation and validation, `RUN_DB_INIT_ON_BOOT` may be set to `false`. Always-run idempotent migrations still execute.

## Zoho transactional email

For a paid organization account in the India data center:

```env
PASSWORD_RESET_DELIVERY_MODE=email
SMTP_HOST=smtppro.zoho.in
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=team@gymvault.tech
SMTP_PASS=<zoho-app-specific-password>
SMTP_FROM_NAME=GymVault
SMTP_FROM_EMAIL=team@gymvault.tech
```

Generate the app-specific password in Zoho Accounts under Security. Enter it directly in local `.env` and Render; never put it in chat or Git.

Verification:

```powershell
npm run check:providers
```

After SMTP verification passes, request a real signup OTP from the production signup page and confirm it arrives at a test inbox.

## Razorpay architecture

### Platform SaaS billing

Gym owners pay GymVault for plans and add-ons through the main Razorpay account. The backend creates and verifies Razorpay orders in `routes/billing.js` using:

```env
RAZORPAY_KEY_ID=<platform-live-key-id>
RAZORPAY_KEY_SECRET=<platform-live-key-secret>
```

This flow updates the gym subscription only after signature and order verification.

### Gym member collections

Member payments are separate from SaaS billing.

- Direct UPI: the gym saves a UPI ID and the app renders an intent/QR.
- Manual Razorpay: the gym saves its own key id and encrypted secret.
- Partner/Route: the platform creates a payment link with platform keys and routes the gym share to the stored connected `acc_` account.

Route fee behavior:

```env
RAZORPAY_PLATFORM_FEE_PERCENT=0
```

At zero, the full member collection is transferred to the connected gym account. Change only after product/legal/accounting review.

Partner onboarding variables are intentionally deferred:

```env
RAZORPAY_PARTNER_CONNECT_BASE_URL=
RAZORPAY_PARTNER_CLIENT_ID=
RAZORPAY_PARTNER_CLIENT_SECRET=
RAZORPAY_PARTNER_REDIRECT_URI=
```

Without these and without a stored connected account id, a fresh gym cannot use Route onboarding. Direct UPI and manual Razorpay remain available. Platform SaaS billing remains fully independent.

Payroll and POS do not pay through Razorpay. Payroll records manual cash, UPI intent, or bank-transfer settlement. POS records local payment modes and inventory/revenue entries.

## MSG91 setup from zero

MSG91 is used for WhatsApp operations and optional owner/staff phone OTP. It is not used for owner signup email OTP or member portal email OTP.

### WhatsApp prerequisites

1. Create or recover the MSG91 account.
2. Enable WhatsApp in MSG91.
3. Connect a Meta Business account.
4. Complete Meta business verification if required.
5. Add and verify the WhatsApp business number.
6. Wait until the number appears in MSG91's WhatsApp activation list.
7. Create an MSG91 API auth key with WhatsApp access.

Render variables:

```env
MSG91_WHATSAPP_AUTH_KEY=<new-msg91-key>
MSG91_WHATSAPP_WEBHOOK_TOKEN=<new-random-webhook-token>
MSG91_SEND_CONCURRENCY=5
WHATSAPP_META_SUPPRESSION_COOLDOWN_HOURS=24
MSG91_PORTAL_SIGNIN_URL=https://control.msg91.com/signin/
MSG91_WHATSAPP_ONBOARDING_URL=
MSG91_WHATSAPP_GUIDE_URL=https://msg91.com/help/whatsapp/whatsapp-number-integration---onboarding
MSG91_META_BUSINESS_URL=https://business.facebook.com/
MSG91_WHATSAPP_SUPPORT_URL=https://calendly.com/onbording-msg91/20-min-onbording
```

In GymVault owner Settings > Integrations > Messaging:

1. Enter the same verified WhatsApp business number.
2. Save messaging setup.
3. Refresh provider state.
4. Let GymVault submit/sync built-in templates.
5. Wait for Meta/MSG91 approval.
6. Send a test template from the app.

Configure the MSG91 delivery webhook to:

```text
https://gymvault-earv.onrender.com/api/settings/platform/whatsapp-delivery/webhook?token=<MSG91_WHATSAPP_WEBHOOK_TOKEN>
```

### Optional MSG91 phone OTP

The current owner UI does not expose phone OTP login. Keep phone OTP in preview/disabled configuration unless that UI is intentionally enabled later:

```env
MSG91_OTP_AUTH_KEY=
MSG91_OTP_TEMPLATE_ID=
MSG91_OTP_MODE=preview
MSG91_OWNER_LOGIN_OTP_MODE=preview
```

If enabled later, an India DLT-approved OTP template and matching MSG91 template ID are required.

## Verification commands

Read-only provider readiness:

```powershell
npm run check:providers
```

Backend syntax and local runtime:

```powershell
npm test
npm run smoke:backend
```

Production frontend/backend routing:

```powershell
npm run smoke:production
```

Expected final provider readiness:

- Supabase PostgreSQL: pass
- Zoho SMTP: pass
- Google OAuth: pass when configured
- Razorpay platform account: pass
- MSG91 WhatsApp: pass after number onboarding
- MSG91 phone OTP: warning is acceptable while intentionally deferred

## End-to-end release checklist

1. `/healthz` reports `database=reachable`.
2. `gymvault.tech/api/auth/config` returns HTTP 200.
3. Signup OTP reaches a new test email.
4. Email signup creates the first test gym owner.
5. Email/password login succeeds.
6. Password reset OTP reaches the test owner.
7. Google signup creates a separate controlled test owner.
8. Google login restores that account.
9. Create a test plan and test member with an email.
10. Member portal email OTP arrives and member login succeeds.
11. Platform Razorpay config loads for the owner.
12. Use Razorpay test mode before any new payment-flow changes; never create accidental live charges during smoke testing.
13. Direct UPI member collection renders correctly.
14. MSG91 detects the integrated number.
15. Built-in templates reach approved status.
16. A controlled WhatsApp test message is submitted and its webhook status is recorded.
17. Dashboard, members, attendance, plans, payments, finance, insights, settings, and support read endpoints pass with a test owner token.

## Secret rotation

Any password, app password, API secret, or auth key pasted into chat or screenshots must be treated as exposed. Rotate it at the provider, then update local `.env` and Render directly. Do not commit `.env`.

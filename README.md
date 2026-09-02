# Zenith Bank Loan Eligibility Portal

A college-project-ready loan eligibility website with a responsive frontend, SQLite database, verified-email accounts, backend APIs, submission tracking, and automatic email notifications.

## What works

- Customer eligibility form and instant indicative result
- Persistent SQLite records for applicants, eligibility checks, and applications
- Secure account registration, PBKDF2 password hashing, email verification, and signed-in sessions
- Real application reference when a user selects **Apply Online**
- Automatic emails to registered users for verification, eligibility results, and application receipt
- Optional immediate email alerts to the project owner
- Protected admin summary API for a demo dashboard
- Docker packaging and automated backend checks

## Run locally

You need Python 3.8 or later.

```bash
python server.py
```

Open [http://localhost:8080](http://localhost:8080). The database file `loan_portal.db` is created automatically and is excluded from Git.

Run checks with:

```bash
python test_suite.py
```

## Configure account and notification emails

Copy `.env.example` to `.env`. The supplied template uses Brevo's transactional-email API, which is required for users to verify their account and receive updates:

```dotenv
OWNER_NOTIFICATION_EMAIL=your-email@example.com
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER=Zenith Loan Portal <verified-sender@example.com>
APP_BASE_URL=http://127.0.0.1:8080
```

In Brevo, first verify the `BREVO_SENDER` address, then create an API key. Put that key only in `BREVO_API_KEY`; never commit it.

Notifications include applicant and loan-request details but mask PAN and mobile values. Full records remain in the local SQLite database.

For deployment, use a transactional provider (for example Brevo, SendGrid, Mailgun, or Amazon SES), set `APP_BASE_URL` to the public **HTTPS** address, and set `COOKIE_SECURE=true`. Do not use a personal email password; use the provider's SMTP credential or app password.

## Customer authentication

Use **Sign in / Register** in the header to create an account. The portal sends a one-time verification link, then creates a secure seven-day HTTP-only session after the link is opened. Eligibility checks and applications must use the same verified email address as the signed-in account.

## Admin summary API

Set `ADMIN_API_KEY` in `.env`, then use the key in an `X-Admin-Key` request header:

```bash
curl http://localhost:8080/api/v1/admin/summary -H "X-Admin-Key: your-admin-key"
```

The response includes total applicants, checks, applications, and outcome counts. Do not expose this key in the browser frontend.

## Docker

With Docker Desktop installed:

```bash
docker compose up --build
```

This starts the portal at [http://localhost:8080](http://localhost:8080) and persists its SQLite database in a Docker volume.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/auth/me` | Current signed-in user |
| `POST` | `/api/v1/auth/register` | Create account and send verification email |
| `POST` | `/api/v1/auth/verify-email` | Verify email token and sign in |
| `POST` | `/api/v1/auth/login` | Sign in after verification |
| `POST` | `/api/v1/auth/logout` | End the active session |
| `POST` | `/api/v1/auth/resend-verification` | Send another verification link |
| `POST` | `/api/v1/eligibility/check` | Save an eligibility check and trigger an optional email |
| `POST` | `/api/v1/applications` | Start an application from an existing assessment |
| `GET` | `/api/v1/admin/summary` | Protected project-admin reporting |

## Project scope note

The result is an indicative academic-project eligibility calculation. It does not connect to a real credit bureau, KYC provider, bank loan system, or payment service. A public banking deployment would require a managed database, authentication, encryption, formal compliance review, and verified third-party integrations.

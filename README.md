# Zenith Bank Loan Eligibility Portal

A college-project-ready loan eligibility website with a responsive frontend, SQLite database, backend APIs, submission tracking, and optional owner email notifications.

## What works

- Customer eligibility form and instant indicative result
- Persistent SQLite records for applicants, eligibility checks, and applications
- Real application reference when a user selects **Apply Online**
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

## Configure email alerts (optional)

No email account is required for the project to run. To enable alerts, copy `.env.example` to `.env`, then set:

```dotenv
OWNER_NOTIFICATION_EMAIL=your-email@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-email-app-password
SMTP_FROM=Zenith Loan Portal <your-email@example.com>
```

For Gmail, enable two-step verification and create an App Password. Never commit `.env`.

Notifications include applicant and loan-request details but mask PAN and mobile values. Full records remain in the local SQLite database.

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
| `POST` | `/api/v1/eligibility/check` | Save an eligibility check and trigger an optional email |
| `POST` | `/api/v1/applications` | Start an application from an existing assessment |
| `GET` | `/api/v1/admin/summary` | Protected project-admin reporting |

## Project scope note

The result is an indicative academic-project eligibility calculation. It does not connect to a real credit bureau, KYC provider, bank loan system, or payment service. A public banking deployment would require a managed database, authentication, encryption, formal compliance review, and verified third-party integrations.

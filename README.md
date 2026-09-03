# Zenith Bank Loan Eligibility Portal

A college-project-ready loan eligibility website with a responsive frontend, SQLite database, backend APIs, submission tracking, and optional owner email notifications.

## What works

- Customer eligibility form and instant indicative result
- Persistent SQLite records for applicants, eligibility checks, and applications
- Real application reference when a user selects **Apply Online**
- Automatic application acknowledgement to the applicant and lead alert to the relationship manager
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

## Configure application emails (optional)

No email account is required for the project to run. To send an application receipt to the applicant and lead details to the relationship manager, copy `.env.example` to `.env`, then set:

```dotenv
RELATIONSHIP_MANAGER_EMAIL=relationship-manager@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-email-app-password
SMTP_FROM=Zenith Loan Portal <your-email@example.com>
```

For Gmail, enable two-step verification and create an App Password. Never commit `.env`.

Notifications include applicant and loan-request details but mask PAN and mobile values. Full records remain in the local SQLite database.

When an application is submitted, the applicant receives a confirmation with the application reference. The relationship manager receives the lead details, including masked PAN and mobile number.

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

## Render (free deployment)

This repository includes `render.yaml` for a Docker web service. In Render,
create a **Blueprint** from the GitHub repository and select the `main` branch.
The frontend and API are served by the same service, so no separate backend URL
is required. The included free-plan configuration stores SQLite data in an
ephemeral filesystem; submissions are cleared whenever Render restarts or
redeploys the service. Use a paid persistent disk or a managed database before
using this beyond a demo.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/eligibility/check` | Save an eligibility check and trigger an optional email |
| `POST` | `/api/v1/applications` | Start an application from an existing assessment |
| `GET` | `/api/v1/admin/summary` | Protected project-admin reporting |

## Project scope note

The result is an indicative academic-project eligibility calculation. It does not connect to a real credit bureau, KYC provider, bank loan system, or payment service. A public banking deployment would require a managed database, authentication, encryption, formal compliance review, and verified third-party integrations.

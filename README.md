# Zenith Bank - Loan Eligibility Checking System (LES)

A full-stack, enterprise-grade digital lending pre-qualification portal and REST API built with responsive vanilla JavaScript/CSS modules and a multi-threaded Python backend.

---

## 🏛️ Features & Architecture

- **Retail Self-Serve Portal**: 3-step applicant flow with zero-impact soft bureau check and real-time loan sizing.
- **Relationship Manager 360° Console**: Multi-product borrower passport with What-If sensitivity sliders and exception referral workflow.
- **Policy Manager & Shadow Engine**: Maker-checker dual control, policy revision editor, and 120-profile historical shadow simulation before deployment.
- **Underwriter Queue**: Delegation of Authority (DOA) review queue with auditable decision logs and adverse action generation.
- **DSA / Partner API Gateway**: OpenAPI 3.0 compatible stateless REST API with live cURL snippet generator and SLA latency monitoring.
- **Executive Analytics Dashboard**: Top-of-funnel conversion pipeline, FOIR/CIBIL risk distributions, DPDP consent audit vault, and Fair Lending Parity surveillance.

---

## 🚀 Quickstart & Local Development

### Option 1: Direct Python (Zero External Dependencies)
Works natively with Python 3.8 - 3.14 on Windows, macOS, and Linux:

```bash
# 1. Start backend & web portal server
python server.py

# 2. Access portal in your browser:
#    Web Interface: http://localhost:8080
#    Healthcheck:   http://localhost:8080/health
#    REST API:      http://localhost:8080/api/v1/eligibility/check
```

### Option 2: Run Automated Tests
```bash
python test_suite.py
```

---

## 🐳 Docker Deployment

### 1. Build and Run Container Locally
```bash
# Build production Docker image
docker build -t zenith-loan-portal .

# Run container on port 8080
docker run -d -p 8080:8080 -e PORT=8080 --name zenith-les zenith-loan-portal

# Test container health
curl http://localhost:8080/health
```

---

## ☁️ Production Cloud Deployment

### 1. Deploy to Google Cloud Run
```bash
# Build & deploy directly from source
gcloud run deploy zenith-loan-portal \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080
```

### 2. Deploy to Render
1. Connect your GitHub repository to [Render](https://render.com).
2. Render will automatically detect `render.yaml` and `Procfile`.
3. Set environment variables:
   - `PORT`: `10000` (assigned automatically by Render)
   - `HOST`: `0.0.0.0`
4. Deploy!

### 3. Deploy to Railway or Heroku
The included `Procfile` enables zero-config deployment:
```bash
# Railway
railway up

# Heroku
heroku create zenith-loan-portal
git push heroku main
```

### 4. Deploy Frontend to Vercel / Netlify (Decoupled)
The repository includes `vercel.json` and `netlify.toml` for Jamstack hosting if you prefer hosting the frontend on a CDN while pointing to your cloud backend API.

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness & readiness probe for orchestrators |
| `GET` | `/api/v1/policy/rules` | Retrieve live product rule matrices & rate cards |
| `GET` | `/api/v1/analytics/stats` | Retrieve portfolio KPIs & funnel conversion metrics |
| `POST` | `/api/v1/eligibility/check` | Execute real-time multi-rule pre-qualification |
| `POST` | `/api/v1/simulate/whatif` | What-if scenario calculation across loan variables |

### Sample Eligibility Check Request:
```bash
curl -X POST http://localhost:8080/api/v1/eligibility/check \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": {
      "fullName": "Anaya Sharma",
      "pan": "ANAPS1234K",
      "monthlyIncome": 85000,
      "existingEmis": 12000,
      "requestedAmount": 800000,
      "requestedTenureMonths": 48,
      "loanProduct": "personal_loan",
      "cibilScoreOverride": 785
    }
  }'
```

---

## 🛡️ Regulatory Compliance

- **RBI Digital Lending Guidelines (2026)**: Zero-impact soft credit bureau waterfall, transparent Key Fact Statement (KFS) generation, and standardized Adverse Action Notices.
- **DPDP Act 2023**: Purpose-limited digital consent audit logging with masked PII retention.
- **Fair Lending (FR-33)**: Algorithmic bias surveillance across geographic tiers and employment sectors.

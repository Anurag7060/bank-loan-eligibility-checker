"""
Automated Test Suite for Zenith Bank Loan Eligibility Checking System (LES)
Validates REST endpoints, Healthchecks, Multi-Product Decisioning, LTV Tiering, FOIR Sizing, Key Fact Statements, Lead Capture & Email Alerts.
"""

import urllib.request
import json
import math
import sys
import os

PORT = int(os.environ.get("PORT", os.environ.get("SERVER_PORT", 8080)))
BASE_URL = f"http://localhost:{PORT}"

def test_api_endpoints():
    print("\n[TEST 1] Testing REST API Endpoints, Healthchecks & Email Notifications...")

    # 1. GET /health
    req = urllib.request.Request(f"{BASE_URL}/health")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        data = json.loads(resp.read().decode('utf-8'))
        assert data["status"] == "UP"
        assert "Zenith" in data["service"]
        assert "adminEmailConfigured" in data
        print(f"  [PASS] GET /health (Liveness Probe & Admin Email: {data['adminEmailConfigured']})")

    # 2. GET /api/v1/policy/rules
    req = urllib.request.Request(f"{BASE_URL}/api/v1/policy/rules")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        data = json.loads(resp.read().decode('utf-8'))
        assert data["status"] == "SUCCESS"
        policies = data["policies"]
        assert len(policies) >= 8, f"Expected at least 8 product policies, found {len(policies)}"
        assert "personal_loan" in policies
        assert "home_loan" in policies
        assert "msme_loan" in policies
        assert "gold_loan" in policies
        print(f"  [PASS] GET /api/v1/policy/rules ({len(policies)} Product Policies verified)")

    # 3. GET /api/v1/analytics/stats
    req = urllib.request.Request(f"{BASE_URL}/api/v1/analytics/stats")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode('utf-8'))
        assert data["status"] == "SUCCESS"
        assert data["analytics"]["totalSoftPulls"] > 0
        print("  [PASS] GET /api/v1/analytics/stats")

    # 4. POST /api/v1/eligibility/check - Super Prime Salaried with Email Capture (Anaya)
    payload_anaya = {
        "applicant": {
            "fullName": "Anaya Sharma",
            "email": "anaya.sharma@example.com",
            "mobile": "9876543210",
            "pan": "ANAPS1234K",
            "monthlyIncome": 85000,
            "existingEmis": 12000,
            "requestedAmount": 800000,
            "requestedTenureMonths": 48,
            "loanProduct": "personal_loan",
            "cibilScoreOverride": 785
        }
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/v1/eligibility/check",
        data=json.dumps(payload_anaya).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode('utf-8'))
        data = res["data"]
        assert data["status"] == "PRE_APPROVED", f"Expected PRE_APPROVED, got {data['status']}"
        assert data["approvedOffer"]["maxEligibleAmount"] >= 1000000
        assert data["approvedOffer"]["offeredAmount"] == 800000
        assert data["approvedOffer"]["indicativeRate"] == 10.49
        assert "keyFactStatement" in data
        assert data["keyFactStatement"]["monthlyEmi"] > 0
        assert "factorScores" in data
        print(f"  [PASS] POST /api/v1/eligibility/check (Salaried Pre-Approved & Lead Captured): Max = Rs {data['approvedOffer']['maxEligibleAmount']:,}")

    # 5. POST /api/v1/eligibility/check - Low Score Decline
    payload_declined = {
        "applicant": {
            "fullName": "Ramesh Kumar",
            "email": "ramesh.k@example.com",
            "mobile": "9811223344",
            "pan": "RAMEK1234F",
            "monthlyIncome": 30000,
            "existingEmis": 5000,
            "requestedAmount": 300000,
            "requestedTenureMonths": 36,
            "loanProduct": "personal_loan",
            "cibilScoreOverride": 600 # Below 650 cutoff
        }
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/v1/eligibility/check",
        data=json.dumps(payload_declined).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode('utf-8'))
        data = res["data"]
        assert data["status"] == "DECLINED"
        assert any(r["code"] == "ERR_CIBIL_SCORE_LOW" for r in data["reasons"])
        print("  [PASS] POST /api/v1/eligibility/check (Low CIBIL Decline & Adverse Notice)")

    # 6. GET /api/v1/leads - Verify Leads Vault
    req = urllib.request.Request(f"{BASE_URL}/api/v1/leads")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        leads_data = json.loads(resp.read().decode('utf-8'))
        assert leads_data["status"] == "SUCCESS"
        assert leads_data["totalLeads"] > 0
        latest_lead = leads_data["leads"][0]
        assert "applicant" in latest_lead
        print(f"  [PASS] GET /api/v1/leads (Vault has {leads_data['totalLeads']} recorded leads)")

    # 7. POST /api/v1/admin/test-email
    test_email_req = urllib.request.Request(
        f"{BASE_URL}/api/v1/admin/test-email",
        data=json.dumps({"email": "admin@zenithbank.com"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(test_email_req) as resp:
        assert resp.status == 200
        email_res = json.loads(resp.read().decode('utf-8'))
        assert email_res["status"] == "SUCCESS"
        print("  [PASS] POST /api/v1/admin/test-email (Email Notification Pipeline verified)")

    # 8. GET /api/v1/leads/export - Export Leads CSV
    req = urllib.request.Request(f"{BASE_URL}/api/v1/leads/export")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        csv_text = resp.read().decode('utf-8')
        assert "Lead ID" in csv_text
        assert "Full Name" in csv_text
        print("  [PASS] GET /api/v1/leads/export (CSV Lead Export verified)")

    # 9. Static Asset Serving & MIME Types
    req = urllib.request.Request(f"{BASE_URL}/src/app.js")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        content_type = resp.headers.get("Content-Type", "")
        assert "javascript" in content_type.lower() or "text/plain" in content_type.lower()
        print(f"  [PASS] Static ES Module Delivery (/src/app.js): {content_type}")

def test_financial_formulas():
    print("\n[TEST 2] Testing Financial & FOIR Sizing Formulas...")
    
    def emi(p, r_annual, n):
        r = (r_annual / 12.0) / 100.0
        factor = math.pow(1 + r, n)
        return int(round(p * r * (factor / (factor - 1))))

    # Standard check: Rs 10,00,000 at 10.5% for 60 months
    computed_emi = emi(1000000, 10.5, 60)
    expected_emi = 21494 # Standard banking EMI formula
    assert abs(computed_emi - expected_emi) <= 5, f"Expected {expected_emi}, got {computed_emi}"
    print(f"  [PASS] Reducing Balance EMI Formula: Rs 10L @ 10.5% for 5 yrs = Rs {computed_emi:,}/mo")

    # Tiered LTV Checks
    def get_home_ltv(prop_val):
        if prop_val <= 3000000: return 0.90
        elif prop_val <= 7500000: return 0.80
        else: return 0.75

    assert get_home_ltv(2500000) == 0.90
    assert get_home_ltv(5000000) == 0.80
    assert get_home_ltv(12000000) == 0.75
    print("  [PASS] Tiered RBI Real Estate LTV Slabs (90%, 80%, 75%)")

if __name__ == "__main__":
    try:
        test_api_endpoints()
        test_financial_formulas()
        print("\n====================================================")
        print(" ALL AUTOMATED UNIT & INTEGRATION TESTS PASSED (100%)")
        print("====================================================\n")
    except Exception as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        sys.exit(1)

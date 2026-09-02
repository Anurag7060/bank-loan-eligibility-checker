"""Zenith Loan Eligibility Portal backend (stdlib-only).

Run with: python server.py
Configure SMTP and the recipient in a .env file copied from .env.example.
"""

import json
import os
import re
import smtplib
import sqlite3
import ssl
from contextlib import contextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
MOBILE_RE = re.compile(r"^[6-9][0-9]{9}$")


def load_env_file():
    """Load local development settings without overriding real environment variables."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# Load local configuration before evaluating database and mail settings.
load_env_file()
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(ROOT / "loan_portal.db")))


@contextmanager
def db_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialise_database():
    with db_connection() as db:
        db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS applicants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                pan TEXT NOT NULL,
                mobile TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(pan)
            );
            CREATE TABLE IF NOT EXISTS eligibility_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_id INTEGER NOT NULL REFERENCES applicants(id),
                assessment_id TEXT NOT NULL UNIQUE,
                loan_product TEXT NOT NULL,
                requested_amount INTEGER NOT NULL,
                requested_tenure_months INTEGER NOT NULL,
                monthly_income INTEGER NOT NULL,
                existing_emis INTEGER NOT NULL,
                decision_status TEXT NOT NULL,
                offer_amount INTEGER NOT NULL DEFAULT 0,
                indicative_rate REAL,
                evaluation_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS loan_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_reference TEXT NOT NULL UNIQUE,
                applicant_id INTEGER NOT NULL REFERENCES applicants(id),
                eligibility_check_id INTEGER NOT NULL REFERENCES eligibility_checks(id),
                status TEXT NOT NULL DEFAULT 'SUBMITTED',
                created_at TEXT NOT NULL
            );
        """)


def now():
    return datetime.now(timezone.utc).isoformat()


def masked_pan(pan):
    return f"{pan[:2]}******{pan[-2:]}" if len(pan) >= 4 else "Masked"


def masked_mobile(mobile):
    return f"******{mobile[-4:]}" if len(mobile) >= 4 else "Masked"


def validate_applicant(data):
    required = ("fullName", "email", "pan", "mobile")
    if not isinstance(data, dict) or any(not str(data.get(field, "")).strip() for field in required):
        raise ValueError("Full name, email, PAN and mobile number are required.")
    applicant = {
        "full_name": str(data["fullName"]).strip()[:120],
        "email": str(data["email"]).strip().lower()[:254],
        "pan": str(data["pan"]).strip().upper(),
        "mobile": re.sub(r"\D", "", str(data["mobile"])),
    }
    if not EMAIL_RE.fullmatch(applicant["email"]):
        raise ValueError("Enter a valid email address.")
    if not PAN_RE.fullmatch(applicant["pan"]):
        raise ValueError("Enter a valid PAN number.")
    if not MOBILE_RE.fullmatch(applicant["mobile"]):
        raise ValueError("Enter a valid 10-digit Indian mobile number.")
    return applicant


def upsert_applicant(db, applicant):
    timestamp = now()
    db.execute("""
        INSERT INTO applicants (full_name, email, pan, mobile, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(pan) DO UPDATE SET full_name=excluded.full_name, email=excluded.email,
            mobile=excluded.mobile, updated_at=excluded.updated_at
    """, (*applicant.values(), timestamp, timestamp))
    return db.execute("SELECT id FROM applicants WHERE pan = ?", (applicant["pan"],)).fetchone()["id"]


def send_email(recipient, subject, body):
    """Send an email through the configured provider without exposing delivery failures to clients."""
    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    if not all((recipient, host, username, password)):
        return False, "SMTP is not configured"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = os.getenv("SMTP_FROM", username)
    message["To"] = recipient
    message.set_content(body)
    port = int(os.getenv("SMTP_PORT", "587"))
    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(username, password)
            smtp.send_message(message)
        return True, None
    except (OSError, smtplib.SMTPException) as error:
        return False, str(error)


def send_notification(subject, body):
    """Send an owner alert when an owner address is configured."""
    recipient = os.getenv("OWNER_NOTIFICATION_EMAIL", "").strip()
    if not recipient:
        return False, "Owner email is not configured"
    return send_email(recipient, subject, body)


def eligibility_email(applicant, check):
    return "\n".join((
        "A new loan eligibility check was submitted.", "",
        f"Name: {applicant['full_name']}", f"Email: {applicant['email']}",
        f"Mobile: {masked_mobile(applicant['mobile'])}", f"PAN: {masked_pan(applicant['pan'])}",
        f"Product: {check['loanProduct']}", f"Requested amount: INR {check['requestedAmount']:,}",
        f"Requested tenure: {check['requestedTenureMonths']} months",
        f"Monthly income: INR {check['monthlyIncome']:,}", f"Existing EMIs: INR {check['existingEmis']:,}",
        f"Decision: {check['status']}", f"Eligible offer: INR {check['offerAmount']:,}",
        f"Assessment ID: {check['assessmentId']}",
    ))


class PortalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self.respond_json(HTTPStatus.OK, {"status": "ok", "database": "sqlite"})
        if path == "/api/v1/admin/summary":
            return self.admin_summary()
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/v1/eligibility/check":
            return self.save_eligibility_check()
        if path == "/api/v1/applications":
            return self.create_application()
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found"})

    def read_json(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 100_000:
                raise ValueError("Request body must be between 1 and 100,000 bytes.")
            return json.loads(self.rfile.read(size).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            raise ValueError(f"Invalid JSON request: {error}") from error

    def save_eligibility_check(self):
        try:
            payload = self.read_json()
            applicant = validate_applicant(payload.get("applicant"))
            result = payload.get("result")
            if not isinstance(result, dict):
                raise ValueError("Eligibility result is required.")
            assessment_id = str(result.get("assessmentId", "")).strip()
            status = str(result.get("status", "")).strip()
            terms, offer = result.get("requestedTerms", {}), result.get("approvedOffer", {})
            if not assessment_id or status not in {"PRE_APPROVED", "CONDITIONAL", "DECLINED"}:
                raise ValueError("Invalid eligibility assessment.")
            check = {
                "assessmentId": assessment_id, "loanProduct": str(result.get("productId", "unknown"))[:50],
                "requestedAmount": int(terms.get("amount", 0)), "requestedTenureMonths": int(terms.get("tenureMonths", 0)),
                "monthlyIncome": int(result.get("metrics", {}).get("monthlyIncome", 0)),
                "existingEmis": int(result.get("metrics", {}).get("existingEmis", 0)), "status": status,
                "offerAmount": int(offer.get("offeredAmount", 0)), "indicativeRate": offer.get("indicativeRate"),
            }
            if check["requestedAmount"] <= 0 or check["requestedTenureMonths"] <= 0:
                raise ValueError("Invalid requested loan terms.")
            with db_connection() as db:
                applicant_id = upsert_applicant(db, applicant)
                cursor = db.execute("""INSERT INTO eligibility_checks
                    (applicant_id, assessment_id, loan_product, requested_amount, requested_tenure_months,
                     monthly_income, existing_emis, decision_status, offer_amount, indicative_rate, evaluation_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (applicant_id, check["assessmentId"], check["loanProduct"], check["requestedAmount"], check["requestedTenureMonths"],
                     check["monthlyIncome"], check["existingEmis"], check["status"], check["offerAmount"], check["indicativeRate"],
                     json.dumps(result, separators=(",", ":")), now()))
                check_id = cursor.lastrowid
            sent, warning = send_notification(f"Loan eligibility check: {applicant['full_name']}", eligibility_email(applicant, check))
            self.respond_json(HTTPStatus.CREATED, {"id": check_id, "assessmentId": assessment_id, "notificationSent": sent, "notificationWarning": warning})
        except (ValueError, TypeError) as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.respond_json(HTTPStatus.CONFLICT, {"error": "This eligibility assessment was already recorded."})
        except Exception:
            self.log_error("Unable to save eligibility check")
            self.respond_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unable to save eligibility check."})

    def create_application(self):
        try:
            payload = self.read_json()
            assessment_id = str(payload.get("assessmentId", "")).strip()
            if not assessment_id:
                raise ValueError("Assessment ID is required.")
            with db_connection() as db:
                row = db.execute("""SELECT e.id, a.full_name, a.email, a.pan, a.mobile, e.loan_product,
                    e.requested_amount, e.decision_status FROM eligibility_checks e JOIN applicants a ON a.id=e.applicant_id
                    WHERE e.assessment_id=?""", (assessment_id,)).fetchone()
                if not row:
                    raise ValueError("Eligibility assessment was not found. Please check eligibility again.")
                reference = f"APP-{datetime.now().strftime('%Y%m%d')}-{row['id']:06d}"
                db.execute("INSERT INTO loan_applications (application_reference, applicant_id, eligibility_check_id, created_at) VALUES (?, ?, ?, ?)",
                           (reference, db.execute("SELECT applicant_id FROM eligibility_checks WHERE id=?", (row["id"],)).fetchone()[0], row["id"], now()))
            applicant = dict(row)
            body = "\n".join(("A customer started a loan application.", "", f"Application reference: {reference}",
                f"Name: {applicant['full_name']}", f"Email: {applicant['email']}", f"Mobile: {masked_mobile(applicant['mobile'])}",
                f"PAN: {masked_pan(applicant['pan'])}", f"Product: {applicant['loan_product']}", f"Requested amount: INR {applicant['requested_amount']:,}", f"Eligibility outcome: {applicant['decision_status']}"))
            sent, warning = send_notification(f"New loan application: {reference}", body)
            self.respond_json(HTTPStatus.CREATED, {"applicationReference": reference, "notificationSent": sent, "notificationWarning": warning})
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.respond_json(HTTPStatus.CONFLICT, {"error": "An application has already been started for this assessment."})
        except Exception:
            self.log_error("Unable to create application")
            self.respond_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unable to create application."})

    def admin_summary(self):
        """Small protected reporting endpoint useful for a project demo/admin panel."""
        required_key = os.getenv("ADMIN_API_KEY", "").strip()
        supplied_key = self.headers.get("X-Admin-Key", "")
        if not required_key or supplied_key != required_key:
            return self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": "Admin access is not authorized."})
        with db_connection() as db:
            totals = db.execute("""SELECT
                (SELECT COUNT(*) FROM applicants) AS applicants,
                (SELECT COUNT(*) FROM eligibility_checks) AS eligibility_checks,
                (SELECT COUNT(*) FROM loan_applications) AS applications
            """).fetchone()
            decisions = db.execute("""SELECT decision_status AS status, COUNT(*) AS count
                FROM eligibility_checks GROUP BY decision_status ORDER BY count DESC""").fetchall()
        self.respond_json(HTTPStatus.OK, {
            "applicants": totals["applicants"],
            "eligibilityChecks": totals["eligibility_checks"],
            "applications": totals["applications"],
            "decisions": [dict(row) for row in decisions],
        })

    def respond_json(self, status, data):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    initialise_database()
    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Zenith portal running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), PortalHandler).serve_forever()

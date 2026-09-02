"""Zenith Loan Eligibility Portal backend (stdlib-only).

Run with: python server.py
Configure SMTP and the recipient in a .env file copied from .env.example.
"""

import json
import hashlib
import hmac
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
from contextlib import contextmanager
from email.utils import parseaddr
from datetime import datetime, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import urlparse
from urllib import error as urlerror
from urllib import request as urlrequest

ROOT = Path(__file__).resolve().parent
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
MOBILE_RE = re.compile(r"^[6-9][0-9]{9}$")
PASSWORD_MINIMUM_LENGTH = 10
SESSION_COOKIE = "zenith_session"
SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7
VERIFICATION_LIFETIME_SECONDS = 60 * 60 * 24
PASSWORD_ITERATIONS = 390_000


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
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                verified_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token_hash TEXT NOT NULL UNIQUE,
                purpose TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
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
        columns = {row["name"] for row in db.execute("PRAGMA table_info(applicants)").fetchall()}
        if "user_id" not in columns:
            db.execute("ALTER TABLE applicants ADD COLUMN user_id INTEGER REFERENCES users(id)")


def now():
    return datetime.now(timezone.utc).isoformat()


def expires_in(seconds):
    return datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + seconds, timezone.utc).isoformat()


def password_hash(password, salt=None):
    """Return a portable PBKDF2 hash; no password is ever stored in plain text."""
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def password_matches(password, stored_hash):
    try:
        algorithm, iterations, salt_hex, expected_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(actual.hex(), expected_hex)
    except (ValueError, TypeError):
        return False


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_credentials(data):
    if not isinstance(data, dict):
        raise ValueError("A valid request is required.")
    email = str(data.get("email", "")).strip().lower()[:254]
    password = str(data.get("password", ""))
    if not EMAIL_RE.fullmatch(email):
        raise ValueError("Enter a valid email address.")
    if len(password) < PASSWORD_MINIMUM_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MINIMUM_LENGTH} characters.")
    return email, password


def public_user(row):
    return {"id": row["id"], "email": row["email"], "verified": bool(row["verified_at"])}


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


def upsert_applicant(db, applicant, user_id=None):
    timestamp = now()
    existing = db.execute("SELECT id, user_id FROM applicants WHERE pan = ?", (applicant["pan"],)).fetchone()
    if existing and existing["user_id"] and user_id and existing["user_id"] != user_id:
        raise ValueError("This PAN is already linked to another account.")
    db.execute("""
        INSERT INTO applicants (full_name, email, pan, mobile, created_at, updated_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pan) DO UPDATE SET full_name=excluded.full_name, email=excluded.email,
            mobile=excluded.mobile, updated_at=excluded.updated_at,
            user_id=COALESCE(applicants.user_id, excluded.user_id)
    """, (*applicant.values(), timestamp, timestamp, user_id))
    return db.execute("SELECT id FROM applicants WHERE pan = ?", (applicant["pan"],)).fetchone()["id"]


def send_email(recipient, subject, body):
    """Send an email through the configured provider without exposing delivery failures to clients."""
    brevo_key = os.getenv("BREVO_API_KEY", "").strip()
    if brevo_key:
        sender_label, sender_email = parseaddr(os.getenv("BREVO_SENDER", os.getenv("SMTP_FROM", "")).strip())
        if not sender_email or not EMAIL_RE.fullmatch(sender_email):
            return False, "Brevo sender email is not configured"
        payload = json.dumps({
            "sender": {"email": sender_email, "name": sender_label or "Zenith Loan Portal"},
            "to": [{"email": recipient}], "subject": subject, "textContent": body,
        }).encode("utf-8")
        request = urlrequest.Request("https://api.brevo.com/v3/smtp/email", data=payload, method="POST", headers={
            "accept": "application/json", "api-key": brevo_key, "content-type": "application/json",
        })
        try:
            with urlrequest.urlopen(request, timeout=15):
                pass
            return True, None
        except urlerror.HTTPError as error:
            return False, f"Brevo API request failed (status {error.code})"
        except (OSError, ValueError) as error:
            return False, f"Brevo email request failed: {error}"

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


def verification_email(email, token):
    base_url = os.getenv("APP_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
    link = f"{base_url}/?verify={token}"
    return "Verify your Zenith Loan Portal account", "\n".join((
        "Welcome to Zenith Loan Portal.", "",
        "Verify your email address to sign in and receive loan updates:", link, "",
        "This link expires in 24 hours. If you did not register, you can ignore this email.",
    ))


def customer_eligibility_email(applicant, check):
    return "Loan eligibility result", "\n".join((
        f"Hello {applicant['full_name']},", "",
        f"Your eligibility check is complete. Outcome: {check['status']}.",
        f"Indicative eligible offer: INR {check['offerAmount']:,}.",
        f"Assessment ID: {check['assessmentId']}", "",
        "This is an indicative result and is subject to verification and underwriting.",
    ))


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
        if path == "/api/v1/auth/me":
            return self.current_user_response()
        if path == "/api/v1/admin/summary":
            return self.admin_summary()
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/v1/auth/register":
            return self.register()
        if path == "/api/v1/auth/verify-email":
            return self.verify_email()
        if path == "/api/v1/auth/resend-verification":
            return self.resend_verification()
        if path == "/api/v1/auth/login":
            return self.login()
        if path == "/api/v1/auth/logout":
            return self.logout()
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

    def session_user(self):
        cookies = SimpleCookie()
        cookies.load(self.headers.get("Cookie", ""))
        morsel = cookies.get(SESSION_COOKIE)
        if not morsel:
            return None
        with db_connection() as db:
            row = db.execute("""SELECT u.id, u.email, u.verified_at FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ?""", (token_hash(morsel.value), now())).fetchone()
        return row

    def require_verified_user(self):
        user = self.session_user()
        if not user:
            raise PermissionError("Please sign in to continue.")
        if not user["verified_at"]:
            raise PermissionError("Verify your email address before continuing.")
        return user

    def set_session_cookie(self, token):
        secure = os.getenv("COOKIE_SECURE", "").lower() in {"1", "true", "yes"}
        cookie = f"{SESSION_COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_LIFETIME_SECONDS}"
        if secure:
            cookie += "; Secure"
        self.send_header("Set-Cookie", cookie)

    def clear_session_cookie(self):
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")

    def create_session(self, user_id):
        token = secrets.token_urlsafe(32)
        with db_connection() as db:
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now(),))
            db.execute("INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                       (user_id, token_hash(token), expires_in(SESSION_LIFETIME_SECONDS), now()))
        return token

    def issue_verification(self, db, user_id, email):
        db.execute("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = 'verify_email' AND used_at IS NULL", (user_id,))
        token = secrets.token_urlsafe(32)
        db.execute("INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
                   (user_id, token_hash(token), "verify_email", expires_in(VERIFICATION_LIFETIME_SECONDS), now()))
        subject, body = verification_email(email, token)
        return send_email(email, subject, body)

    def register(self):
        try:
            email, password = validate_credentials(self.read_json())
            with db_connection() as db:
                existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
                if existing:
                    self.respond_json(HTTPStatus.CONFLICT, {"error": "An account already exists for this email. Please sign in."})
                    return
                timestamp = now()
                cursor = db.execute("INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
                                    (email, password_hash(password), timestamp, timestamp))
                sent, warning = self.issue_verification(db, cursor.lastrowid, email)
            if not sent:
                return self.respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Account created, but verification email could not be sent. Configure SMTP and resend verification.", "warning": warning})
            self.respond_json(HTTPStatus.CREATED, {"message": "Check your inbox to verify your email address."})
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def verify_email(self):
        try:
            token = str(self.read_json().get("token", "")).strip()
            if not token:
                raise ValueError("Verification token is required.")
            with db_connection() as db:
                row = db.execute("""SELECT t.id, t.user_id, u.email FROM auth_tokens t JOIN users u ON u.id=t.user_id
                    WHERE t.token_hash=? AND t.purpose='verify_email' AND t.used_at IS NULL AND t.expires_at > ?""",
                    (token_hash(token), now())).fetchone()
                if not row:
                    raise ValueError("This verification link is invalid or has expired.")
                db.execute("UPDATE auth_tokens SET used_at=? WHERE id=?", (now(), row["id"]))
                db.execute("UPDATE users SET verified_at=?, updated_at=? WHERE id=?", (now(), now(), row["user_id"]))
            session_token = self.create_session(row["user_id"])
            self.respond_json(HTTPStatus.OK, {"user": {"id": row["user_id"], "email": row["email"], "verified": True}}, session_token=session_token)
            send_email(row["email"], "Zenith Loan Portal account verified", "Your email address has been verified. You can now use your account to check loan eligibility and receive updates.")
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def resend_verification(self):
        try:
            email = str(self.read_json().get("email", "")).strip().lower()[:254]
            if not EMAIL_RE.fullmatch(email):
                raise ValueError("Enter a valid email address.")
            with db_connection() as db:
                user = db.execute("SELECT id, verified_at FROM users WHERE email=?", (email,)).fetchone()
                if user and not user["verified_at"]:
                    sent, warning = self.issue_verification(db, user["id"], email)
                    if not sent:
                        return self.respond_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Verification email could not be sent.", "warning": warning})
            self.respond_json(HTTPStatus.OK, {"message": "If an unverified account exists, a new verification email has been sent."})
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def login(self):
        try:
            email, password = validate_credentials(self.read_json())
            with db_connection() as db:
                user = db.execute("SELECT id, email, password_hash, verified_at FROM users WHERE email=?", (email,)).fetchone()
            if not user or not password_matches(password, user["password_hash"]):
                return self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": "Email or password is incorrect."})
            if not user["verified_at"]:
                return self.respond_json(HTTPStatus.FORBIDDEN, {"error": "Verify your email before signing in. You can request a new link below."})
            session_token = self.create_session(user["id"])
            self.respond_json(HTTPStatus.OK, {"user": public_user(user)}, session_token=session_token)
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def logout(self):
        user = self.session_user()
        if user:
            cookies = SimpleCookie(); cookies.load(self.headers.get("Cookie", ""))
            with db_connection() as db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(cookies[SESSION_COOKIE].value),))
        self.respond_json(HTTPStatus.OK, {"message": "Signed out."}, clear_session=True)

    def current_user_response(self):
        user = self.session_user()
        self.respond_json(HTTPStatus.OK, {"user": public_user(user) if user else None})

    def save_eligibility_check(self):
        try:
            user = self.require_verified_user()
            payload = self.read_json()
            applicant = validate_applicant(payload.get("applicant"))
            if applicant["email"] != user["email"]:
                raise ValueError("Use the same email address as your signed-in account.")
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
                applicant_id = upsert_applicant(db, applicant, user["id"])
                cursor = db.execute("""INSERT INTO eligibility_checks
                    (applicant_id, assessment_id, loan_product, requested_amount, requested_tenure_months,
                     monthly_income, existing_emis, decision_status, offer_amount, indicative_rate, evaluation_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (applicant_id, check["assessmentId"], check["loanProduct"], check["requestedAmount"], check["requestedTenureMonths"],
                     check["monthlyIncome"], check["existingEmis"], check["status"], check["offerAmount"], check["indicativeRate"],
                     json.dumps(result, separators=(",", ":")), now()))
                check_id = cursor.lastrowid
            sent, warning = send_notification(f"Loan eligibility check: {applicant['full_name']}", eligibility_email(applicant, check))
            customer_sent, customer_warning = send_email(applicant["email"], *customer_eligibility_email(applicant, check))
            self.respond_json(HTTPStatus.CREATED, {"id": check_id, "assessmentId": assessment_id, "notificationSent": sent,
                "notificationWarning": warning, "customerEmailSent": customer_sent, "customerEmailWarning": customer_warning})
        except PermissionError as error:
            self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": str(error)})
        except (ValueError, TypeError) as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.respond_json(HTTPStatus.CONFLICT, {"error": "This eligibility assessment was already recorded."})
        except Exception:
            self.log_error("Unable to save eligibility check")
            self.respond_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unable to save eligibility check."})

    def create_application(self):
        try:
            user = self.require_verified_user()
            payload = self.read_json()
            assessment_id = str(payload.get("assessmentId", "")).strip()
            if not assessment_id:
                raise ValueError("Assessment ID is required.")
            with db_connection() as db:
                row = db.execute("""SELECT e.id, a.full_name, a.email, a.pan, a.mobile, e.loan_product,
                    e.requested_amount, e.decision_status FROM eligibility_checks e JOIN applicants a ON a.id=e.applicant_id
                    WHERE e.assessment_id=? AND a.user_id=?""", (assessment_id, user["id"])).fetchone()
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
            customer_sent, customer_warning = send_email(applicant["email"], f"Application received: {reference}", "\n".join((
                f"Hello {applicant['full_name']},", "", f"We received your loan application.",
                f"Application reference: {reference}", "We will email you when its status changes.")))
            self.respond_json(HTTPStatus.CREATED, {"applicationReference": reference, "notificationSent": sent,
                "notificationWarning": warning, "customerEmailSent": customer_sent, "customerEmailWarning": customer_warning})
        except PermissionError as error:
            self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": str(error)})
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

    def respond_json(self, status, data, session_token=None, clear_session=False):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        if session_token:
            self.set_session_cookie(session_token)
        if clear_session:
            self.clear_session_cookie()
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    initialise_database()
    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Zenith portal running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), PortalHandler).serve_forever()

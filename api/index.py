"""
Zenith Bank - Loan Eligibility Checking System
Production Vercel Serverless Function Entrypoint
"""

import os
import sys

# Ensure parent directory is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from server import wsgi_app, LoanEligibilityHandler
    app = wsgi_app
    application = wsgi_app
    handler = LoanEligibilityHandler
except Exception as e:
    import json
    def fallback_app(environ, start_response):
        path = environ.get("PATH_INFO", "/")
        cors_headers = [
            ("Access-Control-Allow-Origin", "*"),
            ("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD"),
            ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
            ("Content-Type", "application/json")
        ]
        if environ.get("REQUEST_METHOD", "GET").upper() == "OPTIONS":
            start_response("200 OK", cors_headers)
            return [b""]
        payload = json.dumps({
            "status": "UP",
            "service": "Zenith-Bank-LES",
            "fallback": True,
            "error": str(e)
        }).encode("utf-8")
        start_response("200 OK", cors_headers + [("Content-Length", str(len(payload)))])
        return [payload]

    app = fallback_app
    application = fallback_app
    handler = fallback_app

"""
Zenith Bank - Loan Eligibility Checking System
Vercel Serverless Function Entrypoint
"""

import os
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from server import wsgi_app, LoanEligibilityHandler

# Standard WSGI & HTTP Handler exports for Vercel
app = wsgi_app
application = wsgi_app
handler = LoanEligibilityHandler

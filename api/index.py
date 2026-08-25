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

from server import LoanEligibilityHandler

# Vercel top-level entrypoint exports
handler = LoanEligibilityHandler
app = LoanEligibilityHandler
application = LoanEligibilityHandler

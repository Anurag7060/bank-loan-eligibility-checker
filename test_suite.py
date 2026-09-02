"""Basic backend checks; run with: python test_suite.py"""

import os
import tempfile
import unittest
from pathlib import Path

import server


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.original_database = server.DATABASE_PATH
        server.DATABASE_PATH = Path(self.tempdir.name) / "test.db"
        server.initialise_database()

    def tearDown(self):
        server.DATABASE_PATH = self.original_database
        self.tempdir.cleanup()

    def test_validates_and_persists_an_applicant(self):
        applicant = server.validate_applicant({
            "fullName": "Anaya Sharma", "email": "ANAYA@example.com",
            "pan": "anaps1234k", "mobile": "9876543210",
        })
        self.assertEqual(applicant["email"], "anaya@example.com")
        self.assertEqual(applicant["pan"], "ANAPS1234K")
        with server.db_connection() as db:
            applicant_id = server.upsert_applicant(db, applicant)
            self.assertGreater(applicant_id, 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM applicants").fetchone()[0], 1)

    def test_rejects_invalid_pan(self):
        with self.assertRaises(ValueError):
            server.validate_applicant({
                "fullName": "Test User", "email": "test@example.com",
                "pan": "INVALID", "mobile": "9876543210",
            })

    def test_sensitive_identifiers_are_masked_in_email(self):
        self.assertEqual(server.masked_pan("ANAPS1234K"), "AN******4K")
        self.assertEqual(server.masked_mobile("9876543210"), "******3210")

    def test_customer_application_email_includes_reference_not_sensitive_identifiers(self):
        subject, body = server.customer_application_email({
            "full_name": "Anaya Sharma", "loan_product": "Personal Loan", "requested_amount": 500000,
        }, "APP-20260902-000001")
        self.assertEqual(subject, "Application received")
        self.assertIn("APP-20260902-000001", body)
        self.assertNotIn("PAN", body)
        self.assertNotIn("mobile", body.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)

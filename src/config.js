/**
 * config.js - Global Frontend Configuration
 * Set your deployed Render backend web service URL here.
 */

// Configurable Render backend URL
export const API_BASE_URL = window.ZENITH_CONFIG?.API_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : 'https://zenith-loan-eligibility-portal.onrender.com');

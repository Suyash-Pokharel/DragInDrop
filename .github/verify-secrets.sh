#!/bin/bash

# GitHub Actions Secrets Verification Script
# This script helps verify that the GitHub Secrets are configured correctly

set -e

echo "=========================================="
echo "GitHub Secrets Verification Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print success message
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error message
error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print warning message
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if required environment variables are set
echo "Checking required secrets..."
echo ""

# Check CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
    error "CRON_SECRET is not set"
    echo "  Please set CRON_SECRET as a GitHub Secret and Vercel environment variable"
    exit 1
else
    success "CRON_SECRET is set"
    
    # Check length
    if [ ${#CRON_SECRET} -lt 32 ]; then
        warning "CRON_SECRET is shorter than recommended (32 characters)"
        echo "  Current length: ${#CRON_SECRET} characters"
    else
        success "CRON_SECRET length is adequate (${#CRON_SECRET} characters)"
    fi
fi

echo ""

# Check VERCEL_API_URL
if [ -z "$VERCEL_API_URL" ]; then
    error "VERCEL_API_URL is not set"
    echo "  Please set VERCEL_API_URL as a GitHub Secret"
    exit 1
else
    success "VERCEL_API_URL is set: $VERCEL_API_URL"
    
    # Check if URL starts with https://
    if [[ ! "$VERCEL_API_URL" =~ ^https:// ]]; then
        error "VERCEL_API_URL must start with https://"
        exit 1
    else
        success "VERCEL_API_URL uses HTTPS"
    fi
    
    # Check if URL has trailing slash
    if [[ "$VERCEL_API_URL" =~ /$ ]]; then
        warning "VERCEL_API_URL has a trailing slash (should be removed)"
    else
        success "VERCEL_API_URL format is correct"
    fi
fi

echo ""
echo "=========================================="
echo "Testing API Endpoint"
echo "=========================================="
echo ""

# Test the API endpoint
echo "Sending test request to: ${VERCEL_API_URL}/api/cron/process-scheduled-tiktok-uploads"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    "${VERCEL_API_URL}/api/cron/process-scheduled-tiktok-uploads")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Response Status: $http_code"
echo "Response Body: $body"
echo ""

if [ "$http_code" -eq 200 ]; then
    success "API endpoint is working correctly!"
    echo ""
    echo "✓ All checks passed!"
    echo "✓ GitHub Secrets are configured correctly"
    echo "✓ The scheduled TikTok uploads workflow is ready to use"
elif [ "$http_code" -eq 401 ]; then
    error "Authentication failed (HTTP 401)"
    echo ""
    echo "Possible causes:"
    echo "  1. CRON_SECRET in GitHub doesn't match CRON_SECRET in Vercel"
    echo "  2. CRON_SECRET is not set in Vercel environment variables"
    echo ""
    echo "Solution:"
    echo "  1. Verify both secrets are identical"
    echo "  2. Redeploy your Vercel application"
    echo "  3. Run this script again"
    exit 1
elif [ "$http_code" -eq 404 ]; then
    error "API endpoint not found (HTTP 404)"
    echo ""
    echo "Possible causes:"
    echo "  1. The API route is not deployed"
    echo "  2. VERCEL_API_URL is incorrect"
    echo ""
    echo "Solution:"
    echo "  1. Verify the URL is correct"
    echo "  2. Check that the API route exists in your deployment"
    exit 1
elif [ "$http_code" -eq 500 ]; then
    error "Internal server error (HTTP 500)"
    echo ""
    echo "Possible causes:"
    echo "  1. Missing environment variables in Vercel"
    echo "  2. Database connection error"
    echo "  3. Redis connection error"
    echo ""
    echo "Solution:"
    echo "  1. Check Vercel deployment logs"
    echo "  2. Verify all required environment variables are set"
    exit 1
else
    error "Unexpected response (HTTP $http_code)"
    echo ""
    echo "Please check the response body above for more details"
    exit 1
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="

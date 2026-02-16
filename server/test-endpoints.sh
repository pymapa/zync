#!/bin/bash

# Zync Backend Endpoint Testing Script
# This script tests all backend endpoints

set -e

BASE_URL="http://localhost:3001"
COOKIE_FILE="cookies.txt"

echo "========================================"
echo "Zync Backend Endpoint Testing"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test health endpoint
echo -e "${YELLOW}Testing Health Endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/api/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq .
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test OAuth URL generation
echo -e "${YELLOW}Testing OAuth URL Generation...${NC}"
AUTH_URL_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/strava/url" \
    -H "Content-Type: application/json" \
    -d '{"redirectUri": "http://localhost:5173/callback"}')

if echo "$AUTH_URL_RESPONSE" | grep -q "url"; then
    echo -e "${GREEN}✅ OAuth URL generation passed${NC}"
    echo "$AUTH_URL_RESPONSE" | jq .
    OAUTH_URL=$(echo "$AUTH_URL_RESPONSE" | jq -r .url)
    echo ""
    echo -e "${YELLOW}To complete OAuth flow:${NC}"
    echo "1. Visit this URL in your browser:"
    echo "   ${OAUTH_URL}"
    echo "2. Log in to Strava and authorize"
    echo "3. You'll be redirected with code and state"
else
    echo -e "${RED}❌ OAuth URL generation failed${NC}"
    echo "$AUTH_URL_RESPONSE"
    exit 1
fi
echo ""

# Test 404 handling
echo -e "${YELLOW}Testing 404 Handler...${NC}"
NOT_FOUND_RESPONSE=$(curl -s "${BASE_URL}/api/nonexistent")
if echo "$NOT_FOUND_RESPONSE" | grep -q "NOT_FOUND"; then
    echo -e "${GREEN}✅ 404 handler working${NC}"
    echo "$NOT_FOUND_RESPONSE" | jq .
else
    echo -e "${RED}❌ 404 handler failed${NC}"
    echo "$NOT_FOUND_RESPONSE"
fi
echo ""

# Test rate limiting (only if you want to trigger it)
echo -e "${YELLOW}Testing Rate Limiting (optional)...${NC}"
echo "Sending 6 requests to auth endpoint (rate limit: 5/min)..."
for i in {1..6}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/strava/url" \
        -H "Content-Type: application/json" \
        -d '{"redirectUri": "http://localhost:5173/callback"}')

    if [ "$i" -le 5 ]; then
        if [ "$RESPONSE" -eq 200 ]; then
            echo -e "${GREEN}Request $i: ✅ Allowed (${RESPONSE})${NC}"
        else
            echo -e "${RED}Request $i: ❌ Should be allowed but got ${RESPONSE}${NC}"
        fi
    else
        if [ "$RESPONSE" -eq 429 ]; then
            echo -e "${GREEN}Request $i: ✅ Rate limited (${RESPONSE})${NC}"
        else
            echo -e "${RED}Request $i: ❌ Should be rate limited but got ${RESPONSE}${NC}"
        fi
    fi
    sleep 0.2
done
echo ""

# Test authentication required endpoints
echo -e "${YELLOW}Testing Authentication Required Endpoints...${NC}"

# Test /api/auth/me without auth
ME_RESPONSE=$(curl -s "${BASE_URL}/api/auth/me")
if echo "$ME_RESPONSE" | grep -q "UNAUTHORIZED"; then
    echo -e "${GREEN}✅ /api/auth/me correctly requires authentication${NC}"
    echo "$ME_RESPONSE" | jq .
else
    echo -e "${RED}❌ /api/auth/me should require authentication${NC}"
    echo "$ME_RESPONSE"
fi
echo ""

# Test /api/activities without auth
ACTIVITIES_RESPONSE=$(curl -s "${BASE_URL}/api/activities")
if echo "$ACTIVITIES_RESPONSE" | grep -q "UNAUTHORIZED"; then
    echo -e "${GREEN}✅ /api/activities correctly requires authentication${NC}"
    echo "$ACTIVITIES_RESPONSE" | jq .
else
    echo -e "${RED}❌ /api/activities should require authentication${NC}"
    echo "$ACTIVITIES_RESPONSE"
fi
echo ""

# Test /api/athlete without auth
ATHLETE_RESPONSE=$(curl -s "${BASE_URL}/api/athlete")
if echo "$ATHLETE_RESPONSE" | grep -q "UNAUTHORIZED"; then
    echo -e "${GREEN}✅ /api/athlete correctly requires authentication${NC}"
    echo "$ATHLETE_RESPONSE" | jq .
else
    echo -e "${RED}❌ /api/athlete should require authentication${NC}"
    echo "$ATHLETE_RESPONSE"
fi
echo ""

echo "========================================"
echo "Testing Complete!"
echo "========================================"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Complete OAuth flow manually using the URL above"
echo "2. Once authenticated, you can test protected endpoints"
echo "3. Example authenticated request:"
echo "   curl ${BASE_URL}/api/athlete --cookie-jar cookies.txt"
echo ""

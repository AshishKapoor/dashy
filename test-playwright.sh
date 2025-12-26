#!/bin/bash
set -e

echo "🎭 Playwright E2E Tests for Dataset Preview"
echo "==========================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if services are running
echo -e "${BLUE}Checking services...${NC}"
if ! curl -s http://localhost:8000/api/schema/ > /dev/null; then
    echo -e "${RED}✗ Backend API is not running${NC}"
    echo "  Start with: docker compose up -d api"
    exit 1
fi
echo -e "${GREEN}✓${NC} Backend API is running"

if ! curl -s http://localhost:5173 > /dev/null; then
    echo -e "${RED}✗ Frontend UI is not running${NC}"
    echo "  Start with: docker compose up -d ui"
    exit 1
fi
echo -e "${GREEN}✓${NC} Frontend UI is running"
echo ""

# Ensure test user exists
echo -e "${BLUE}Setting up test user...${NC}"
docker compose exec -T api uv run manage.py shell <<'EOF' > /dev/null 2>&1
from app.accounts.models import User, Organization
org, _ = Organization.objects.get_or_create(name="Demo Org")
user, created = User.objects.get_or_create(
    username="testuser",
    defaults={"organization": org}
)
if created:
    user.set_password("testpass")
    user.save()
    print("Created test user")
else:
    # Ensure password is correct
    user.set_password("testpass")
    user.save()
    print("Updated test user")
EOF
echo -e "${GREEN}✓${NC} Test user ready (username: testuser, password: testpass)"
echo ""

# Run Playwright tests
echo -e "${BLUE}Running Playwright tests...${NC}"
echo ""

cd ui

if [ "$1" = "--ui" ]; then
    echo "Opening Playwright UI..."
    pnpm test:ui
elif [ "$1" = "--headed" ]; then
    echo "Running tests in headed mode..."
    pnpm test:headed
else
    echo "Running tests in headless mode..."
    pnpm test
fi

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All Playwright tests passed!${NC}"
    echo ""
    echo "Test report available at: ui/playwright-report/index.html"
else
    echo ""
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Check the report: ui/playwright-report/index.html"
    exit 1
fi

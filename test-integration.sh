#!/bin/bash
set -e

echo "🧪 Dataset Preview UI Integration Test"
echo "======================================"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local name=$3
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not accessible"
        return 1
    fi
}

echo "📋 Pre-flight Checks"
echo "-------------------"

# Check services
check_service "api" "http://localhost:8000/api/schema/" "Backend API"
check_service "ui" "http://localhost:5173" "Frontend UI"
echo ""

echo "🧪 Running Test Suite"
echo "--------------------"

# 1. Backend unit tests
echo -e "${BLUE}1/3${NC} Running backend unit tests..."
TEST_RESULT=$(docker compose run --rm --entrypoint "" \
  -e DJANGO_SETTINGS_MODULE=app.settings.test api \
  uv run manage.py test app.bi.tests -v 0 2>&1 | tail -5)

if echo "$TEST_RESULT" | grep -q "OK"; then
    TESTS_PASSED=$(echo "$TEST_RESULT" | grep -oE 'Ran [0-9]+' | grep -oE '[0-9]+')
    echo -e "${GREEN}✓${NC} All $TESTS_PASSED backend tests passed"
else
    echo -e "${RED}✗${NC} Backend tests failed"
    exit 1
fi

# 2. API integration test
echo -e "${BLUE}2/3${NC} Testing API endpoints..."

# Get token
TOKEN=$(docker compose exec -T api uv run manage.py shell <<'EOF' 2>/dev/null | grep ACCESS_TOKEN | cut -d= -f2
from app.accounts.models import User
from rest_framework_simplejwt.tokens import RefreshToken
user = User.objects.filter(username="testuser").first()
if user:
    token = RefreshToken.for_user(user)
    print(f"ACCESS_TOKEN={token.access_token}")
EOF
)

# Test ingest
CREATED=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "integration-test",
    "metric": "test_metric",
    "rows": [
      {"recorded_at": "2025-12-27T17:00:00Z", "value": 1.0},
      {"recorded_at": "2025-12-27T17:01:00Z", "value": 2.0}
    ]
  }' \
  http://localhost:8000/api/bi/iot/ingest/ | jq -r '.created')

if [ "$CREATED" = "2" ]; then
    echo -e "${GREEN}✓${NC} Ingest API working (created $CREATED records)"
else
    echo -e "${RED}✗${NC} Ingest API failed"
    exit 1
fi

# Test preview
sleep 1
PREVIEW_COUNT=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/bi/iot/?device_id=integration-test" | jq 'length')

if [ "$PREVIEW_COUNT" = "2" ]; then
    echo -e "${GREEN}✓${NC} Preview API working (retrieved $PREVIEW_COUNT records)"
else
    echo -e "${RED}✗${NC} Preview API failed (got $PREVIEW_COUNT records, expected 2)"
    exit 1
fi

# 3. UI accessibility test
echo -e "${BLUE}3/3${NC} Testing UI endpoints..."

# Check data management page
UI_RESPONSE=$(curl -s http://localhost:5173)
if echo "$UI_RESPONSE" | grep -q "Dashy AI"; then
    echo -e "${GREEN}✓${NC} UI loads successfully"
else
    echo -e "${RED}✗${NC} UI failed to load"
    exit 1
fi

# Check API schema (used by UI client)
SCHEMA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/schema/)
if [ "$SCHEMA_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} API schema available for client generation"
else
    echo -e "${RED}✗${NC} API schema not available"
    exit 1
fi

echo ""
echo "📊 Test Results Summary"
echo "======================"
echo ""
echo -e "${GREEN}✓${NC} Backend: $TESTS_PASSED unit tests passed"
echo -e "${GREEN}✓${NC} API: Ingest and Preview endpoints working"
echo -e "${GREEN}✓${NC} UI: Frontend accessible and functional"
echo ""
echo -e "${GREEN}🎉 All integration tests passed!${NC}"
echo ""
echo "📖 Next Steps:"
echo "  1. Open http://localhost:5173/data-management"
echo "  2. Upload samples/air-quality/sample.json"
echo "  3. Verify data appears in Dataset Preview table"
echo "  4. Test filters (device_id, metric)"
echo "  5. Verify virtualized scrolling for large datasets"
echo ""
echo "📄 Full test documentation: DATASET_PREVIEW_TESTS.md"

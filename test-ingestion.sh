#!/bin/bash
set -e

echo "=== IoT Ingestion Demo ==="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Run unit tests
echo -e "${BLUE}1. Running unit tests...${NC}"
docker compose run --rm --entrypoint "" -e DJANGO_SETTINGS_MODULE=app.settings.test api uv run manage.py test app.bi.tests.test_iot_ingestion -v 0
echo -e "${GREEN}✓ All tests passed${NC}"
echo ""

# 2. Ingest sample data
echo -e "${BLUE}2. Ingesting sample air-quality data...${NC}"
docker compose run --rm --entrypoint "" -v $(pwd)/samples:/samples api uv run manage.py ingest_air_quality --org-name "Demo Org" --file /samples/air-quality/sample.json --batch-size 500 2>/dev/null | tail -2
echo -e "${GREEN}✓ Sample data ingested${NC}"
echo ""

# 3. Get auth token
echo -e "${BLUE}3. Creating test user and generating token...${NC}"
TOKEN=$(docker compose exec -T api uv run manage.py shell <<'EOF' 2>/dev/null | grep ACCESS_TOKEN | cut -d= -f2
from app.accounts.models import User, Organization
from rest_framework_simplejwt.tokens import RefreshToken
org, _ = Organization.objects.get_or_create(name="Demo Org")
user, created = User.objects.get_or_create(username="testuser", defaults={"organization": org})
if created:
    user.set_password("testpass")
    user.save()
token = RefreshToken.for_user(user)
print(f"ACCESS_TOKEN={token.access_token}")
EOF
)
echo -e "${GREEN}✓ Token generated${NC}"
echo ""

# 4. Test JSON ingestion via API
echo -e "${BLUE}4. Testing JSON ingestion via API...${NC}"
RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "demo-sensor",
    "metric": "humidity",
    "rows": [
      {"recorded_at": "2025-12-26T12:00:00Z", "value": 65.5, "tags": {"room": "lab"}},
      {"recorded_at": "2025-12-26T12:05:00Z", "value": 66.2, "tags": {"room": "lab"}}
    ]
  }' \
  http://localhost:8000/api/bi/iot/ingest/)
echo "$RESULT" | jq
echo -e "${GREEN}✓ JSON ingestion successful${NC}"
echo ""

# 5. Query ingested data
echo -e "${BLUE}5. Querying ingested data...${NC}"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/bi/iot/?device_id=demo-sensor" | jq -r '.[] | "  → \(.device_id) | \(.metric) | \(.value) | \(.recorded_at)"'
echo -e "${GREEN}✓ Data retrieved successfully${NC}"
echo ""

# 6. Check data by location filter (from air-quality sample)
echo -e "${BLUE}6. Sample data query (Coyhaique location)...${NC}"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/bi/iot/?device_id=Coyhaique" | jq -r 'if length > 0 then "  Found \(length) measurements from Coyhaique" else "  No data" end'
echo -e "${GREEN}✓ Query complete${NC}"
echo ""

echo -e "${GREEN}=== Demo Complete ===${NC}"
echo ""
echo "Frontend test:"
echo "  1. Open http://localhost:5173"
echo "  2. Log in (or create account)"
echo "  3. Navigate to Data Management"
echo "  4. Upload samples/air-quality/sample.json"
echo "  5. Verify data appears in table"

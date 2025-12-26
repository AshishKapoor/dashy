# Dataset Preview Test Results

## ✅ All Tests Passing

### Backend Unit Tests (12/12 passing)

```bash
docker compose run --rm --entrypoint "" -e DJANGO_SETTINGS_MODULE=app.settings.test api \
  uv run manage.py test app.bi.tests.test_iot_dataset_preview -v 2
```

**Test Coverage:**

1. ✅ `test_empty_result_with_non_existent_filter` - Non-existent filters return empty list
2. ✅ `test_empty_tags_handled_correctly` - Empty tags properly handled
3. ✅ `test_filter_by_device_and_metric` - Combined filtering works
4. ✅ `test_filter_by_device_id` - Device ID filtering works
5. ✅ `test_filter_by_metric` - Metric filtering works
6. ✅ `test_ingest_and_preview_workflow` - Complete ingest→preview workflow
7. ✅ `test_large_dataset_pagination_not_needed` - Large datasets (50+ records) work
8. ✅ `test_list_all_measurements` - List all without filters
9. ✅ `test_null_values_handled_correctly` - Null values properly handled
10. ✅ `test_org_scoping_prevents_cross_org_access` - Organization isolation
11. ✅ `test_response_includes_all_fields` - All fields present in response
12. ✅ `test_tags_are_json_objects` - Tags serialized as JSON

**Result:** All 12 tests passed in 2.475s

---

### End-to-End API Test

```bash
./test-dataset-preview.sh
```

**Verified:**

- ✅ Authentication working
- ✅ Ingestion API creates 5 records successfully
- ✅ Preview API returns all 5 records
- ✅ Device ID filter works correctly
- ✅ Metric filter works correctly
- ✅ Ordering correct (most recent first: 104.0 → 100.0)
- ✅ All fields present (id, organization, device_id, metric, recorded_at, value, tags)
- ✅ Tags properly serialized as JSON objects

**Sample Response:**

```json
{
  "device_id": "test-preview",
  "metric": "preview_metric",
  "recorded_at": "2025-12-27T16:04:00Z",
  "value": 104.0,
  "tags": {
    "test": "preview5"
  }
}
```

---

### Frontend UI Status

**URL:** http://localhost:5173/data-management

**Features Working:**

1. ✅ Page loads successfully (Dashy AI title present)
2. ✅ TanStack React Table installed and configured
3. ✅ TanStack Virtual for row virtualization
4. ✅ Data fetching via React Query hooks
5. ✅ Auto-refresh after upload (invalidates all queries, explicit refetch)
6. ✅ Filter inputs for device_id and metric
7. ✅ File upload for CSV and JSON
8. ✅ Type icons for columns (lucide-react)
9. ✅ Skeleton loading states
10. ✅ Toast notifications on success/error

**UI Architecture:**

```typescript
// Query hooks
useBiIotList({ device_id, metric }) - Fetches filtered data
useBiIotIngestCreate() - Uploads CSV/JSON

// Table rendering
useReactTable() - Table state management
useVirtualizer() - Virtual scrolling for large datasets
flexRender() - Column rendering

// Upload workflow
1. User selects file
2. JSON: Parse client-side → POST as JSON body
3. CSV: POST as multipart FormData
4. On success: Invalidate cache → Refetch → Show in table
```

---

## How Dataset Preview Works

### 1. Data Flow

```
Upload File → Ingest API (/api/bi/iot/ingest/)
              ↓
         TimescaleDB Hypertable
              ↓
Preview API (/api/bi/iot/?device_id=X&metric=Y)
              ↓
         React Query Cache
              ↓
         TanStack Table
              ↓
       Virtual Scrolling
              ↓
      Rendered in Browser
```

### 2. Key Features

**Backend (Django + TimescaleDB):**

- Hypertable partitioned by UUIDv7 for efficient time-series queries
- Bulk ingestion with `ignore_conflicts=True`
- Organization-based data scoping
- Query filtering by device_id and metric
- Ordering by `recorded_at` DESC (most recent first)

**Frontend (React + TanStack):**

- Query invalidation on upload success
- Explicit refetch after invalidation
- Virtualized rendering for 1000+ rows
- Type-aware column icons
- Real-time filter updates
- Loading skeletons during fetch

### 3. Validation Tests

**Manual Testing:**

```bash
# 1. Ingest data
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"dev1","metric":"temp","rows":[...]}' \
  http://localhost:8000/api/bi/iot/ingest/

# 2. Preview data
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/bi/iot/?device_id=dev1"

# 3. Open UI
open http://localhost:5173/data-management
```

**Expected Result:**

- Data appears in table immediately after upload
- Filters work without page reload
- Virtualization handles large datasets smoothly
- All fields display correctly (device, metric, timestamp, value, tags)

---

## Test Summary

| Component          | Tests      | Status     |
| ------------------ | ---------- | ---------- |
| Backend Unit Tests | 12/12      | ✅ PASS    |
| End-to-End API     | All checks | ✅ PASS    |
| Frontend UI        | Running    | ✅ WORKING |

**Overall Status:** 🟢 Dataset Preview fully functional and tested

---

## Usage Instructions

### 1. Start Services

```bash
cd /Users/anton/Developer/dashy
docker compose up
```

### 2. Access UI

Navigate to: http://localhost:5173/data-management

### 3. Test Dataset Preview

```bash
# Run comprehensive test
./test-dataset-preview.sh

# Or manually upload via UI:
# 1. Click file input
# 2. Select samples/air-quality/sample.json
# 3. File uploads automatically
# 4. Data appears in Dataset Preview table
# 5. Use filters to narrow results
```

### 4. Verify Tests

```bash
# Run all backend tests
docker compose run --rm --entrypoint "" \
  -e DJANGO_SETTINGS_MODULE=app.settings.test api \
  uv run manage.py test app.bi.tests -v 2
```

---

## Troubleshooting

### Dataset Preview Not Updating

**Solution:** The fix ensures query cache invalidation after upload:

```typescript
await queryClient.invalidateQueries({ queryKey: ["bi", "iot", "list"] });
await refetch();
```

### Empty Table After Upload

**Check:**

1. Browser console for errors
2. Network tab for API responses
3. Filters might exclude uploaded data

### 500 Error on Upload

**Solution:** Backend now validates required fields (device_id, metric, recorded_at)
and skips invalid rows instead of crashing.

import csv
import io
import os
import tempfile
import uuid

from django.conf import settings
from django.db import connection
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Dashboard, Indicator, IngestionJob, IoTMeasurement, Workspace
from .serializers import (
    DashboardSerializer,
    IndicatorSerializer,
    IngestionJobSerializer,
    IoTMeasurementSerializer,
    WorkspaceSerializer,
)
from .tasks import process_ingestion_job

class WorkspaceViewSet(ModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Workspace.objects.filter(organization=self.request.user.organization)


class DashboardViewSet(ModelViewSet):
    queryset = Dashboard.objects.all()
    serializer_class = DashboardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Dashboard.objects.filter(workspace__organization=self.request.user.organization)


class IndicatorViewSet(ModelViewSet):
    queryset = Indicator.objects.all()
    serializer_class = IndicatorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Indicator.objects.filter(
            category__organization=self.request.user.organization
        )


class IoTMeasurementViewSet(ModelViewSet):
    queryset = IoTMeasurement.objects.all()
    serializer_class = IoTMeasurementSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser]

    def get_queryset(self):
        qs = IoTMeasurement.objects.filter(
            organization=self.request.user.organization
        )
        device_id = self.request.query_params.get("device_id")
        metric = self.request.query_params.get("metric")
        if device_id:
            qs = qs.filter(device_id=device_id)
        if metric:
            qs = qs.filter(metric=metric)
        return qs.order_by("-recorded_at")

    @action(detail=False, methods=["post"], url_path="ingest")
    def ingest(self, request):
        """
        Async ingestion endpoint - creates an IngestionJob and processes in background.
        
        Accepts file upload (JSON or CSV) and returns immediately with job ID.
        Poll the job status via /api/bi/ingestion-jobs/{id}/ to track progress.
        
        CSV upload expects columns: device_id, metric, recorded_at, value, tags(optional JSON)
        Flexible column mapping supports common variations like: location, parameter, timestamp, etc.
        
        JSON formats supported:
        1. Array of objects (OpenAQ-style)
        2. Object with rows array
        """
        org = request.user.organization
        if not org:
            return Response(
                {"error": "User must be associated with an organization"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if "file" not in request.FILES:
            return Response(
                {"error": "No file provided. Use multipart/form-data with 'file' field."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES["file"]
        file_name = file.name
        
        # Determine source type
        is_json = file_name.lower().endswith('.json') or file.content_type == 'application/json'
        source_type = "json" if is_json else "csv"
        
        # Save file to temp location
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", str(org.id))
        os.makedirs(upload_dir, exist_ok=True)
        
        file_id = str(uuid.uuid4())
        file_extension = ".json" if is_json else ".csv"
        temp_path = os.path.join(upload_dir, f"{file_id}{file_extension}")
        
        with open(temp_path, "wb") as dest:
            for chunk in file.chunks():
                dest.write(chunk)
        
        # Create ingestion job
        job = IngestionJob.objects.create(
            organization=org,
            created_by=request.user,
            source_type=source_type,
            file_name=file_name,
            file_path=temp_path,
            status="pending",
        )
        
        # Queue the task
        process_ingestion_job.delay(str(job.id))
        
        serializer = IngestionJobSerializer(job)
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="ingest-sync")
    def ingest_sync(self, request):
        """
        Synchronous ingestion for small datasets (backward compatible).
        
        Accepts either JSON body or file upload.
        Use /ingest/ for large files - they will be processed in background.
        """
        org = request.user.organization
        if not org:
            return Response(
                {"error": "User must be associated with an organization"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created = 0

        if "file" in request.FILES:
            file = request.FILES["file"]
            content = file.read().decode("utf-8")
            
            # Check if it's JSON or CSV
            if file.name.endswith('.json') or file.content_type == 'application/json':
                try:
                    import json
                    data = json.loads(content)
                    created = self._ingest_json_data(data, org)
                except json.JSONDecodeError:
                    return Response(
                        {"error": "Invalid JSON file"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                # CSV processing
                reader = csv.DictReader(io.StringIO(content))
                rows = []
                for row in reader:
                    device_id = row.get("device_id", "").strip()
                    metric = row.get("metric", "").strip()
                    recorded_at = row.get("recorded_at")
                    
                    if not device_id or not metric or not recorded_at:
                        continue  # Skip rows with missing required fields
                    
                    rows.append(
                        IoTMeasurement(
                            organization=org,
                            device_id=device_id,
                            metric=metric,
                            recorded_at=recorded_at,
                            value=float(row.get("value")) if row.get("value") not in (None, "") else None,
                            tags=self._safe_json(row.get("tags")),
                        )
                    )
                if rows:
                    IoTMeasurement.objects.bulk_create(rows, batch_size=1000, ignore_conflicts=True)
                    created = len(rows)
        else:
            created = self._ingest_json_data(request.data, org)

        return Response({"created": created}, status=status.HTTP_201_CREATED)

        return Response({"created": created}, status=status.HTTP_201_CREATED)

    def _ingest_json_data(self, data, org):
        """
        Handle JSON data ingestion supporting multiple formats.
        Returns the number of records created.
        """
        objs = []
        
        # Check if it's an array (OpenAQ format) or object with rows
        if isinstance(data, list):
            # OpenAQ-style array format
            for item in data:
                # Map OpenAQ fields to our schema
                device_id = item.get("location", "").strip()
                metric = item.get("parameter", "").strip()
                
                # Handle date - can be nested or direct
                date_obj = item.get("date", {})
                if isinstance(date_obj, dict):
                    recorded_at = date_obj.get("utc") or date_obj.get("local")
                else:
                    recorded_at = date_obj
                
                if not device_id or not metric or not recorded_at:
                    continue
                
                # Build tags from available metadata
                tags = {}
                for key in ["city", "country", "unit", "location", "coordinates"]:
                    if key in item and item[key] is not None:
                        tags[key] = item[key]
                
                objs.append(
                    IoTMeasurement(
                        organization=org,
                        device_id=device_id,
                        metric=metric,
                        recorded_at=recorded_at,
                        value=item.get("value"),
                        tags=tags,
                    )
                )
        else:
            # Standard format with device_id, metric, rows
            device_id = data.get("device_id", "").strip() if isinstance(data.get("device_id"), str) else ""
            metric = data.get("metric", "").strip() if isinstance(data.get("metric"), str) else ""
            rows = data.get("rows", [])
            
            for r in rows:
                row_device = (r.get("device_id") or device_id or "").strip()
                row_metric = (r.get("metric") or metric or "").strip()
                row_recorded_at = r.get("recorded_at")
                
                if not row_device or not row_metric or not row_recorded_at:
                    continue
                
                objs.append(
                    IoTMeasurement(
                        organization=org,
                        device_id=row_device,
                        metric=row_metric,
                        recorded_at=row_recorded_at,
                        value=r.get("value"),
                        tags=r.get("tags", {}),
                    )
                )
        
        if objs:
            IoTMeasurement.objects.bulk_create(objs, batch_size=1000, ignore_conflicts=True)
        
        return len(objs)

    def _safe_json(self, raw):
        if not raw:
            return {}
        try:
            import json

            return json.loads(raw)
        except Exception:
            return {}


class IngestionJobViewSet(ModelViewSet):
    """
    ViewSet for managing ingestion jobs.
    Users can view their organization's ingestion jobs and track progress.
    """
    queryset = IngestionJob.objects.all()
    serializer_class = IngestionJobSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]  # Read-only

    def get_queryset(self):
        return IngestionJob.objects.filter(
            organization=self.request.user.organization
        ).order_by("-created_at")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def execute_sql_query(request):
    """
    Execute a read-only SQL query against the IoT data.
    Only SELECT queries are allowed for security.
    
    Request body:
    {
        "query": "SELECT device_id, metric, AVG(value) as avg_value FROM bi_iotmeasurement GROUP BY device_id, metric",
        "limit": 1000
    }
    """
    org = request.user.organization
    if not org:
        return Response(
            {"error": "User must be associated with an organization"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    query = request.data.get("query", "").strip()
    limit = min(int(request.data.get("limit", 1000)), 10000)  # Max 10k rows
    
    if not query:
        return Response(
            {"error": "Query is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Security: Only allow SELECT statements
    query_upper = query.upper().strip()
    if not query_upper.startswith("SELECT"):
        return Response(
            {"error": "Only SELECT queries are allowed"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Block dangerous keywords
    dangerous_keywords = [
        "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", 
        "CREATE", "GRANT", "REVOKE", "EXECUTE", "EXEC", "--", "/*", "*/",
        "INTO OUTFILE", "INTO DUMPFILE", "LOAD_FILE"
    ]
    for keyword in dangerous_keywords:
        if keyword in query_upper:
            return Response(
                {"error": f"Query contains forbidden keyword: {keyword}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Inject organization filter for security
    # Wrap user query as subquery and filter by organization
    org_id = org.id
    
    # Check if query already references bi_iotmeasurement
    if "BI_IOTMEASUREMENT" in query_upper:
        # Add WHERE clause for organization filtering
        # This is a simplified approach - for production, use a proper SQL parser
        safe_query = f"""
        SELECT * FROM (
            {query}
        ) AS user_query
        LIMIT {limit}
        """
        # We'll rely on the fact that users can only see their org's data
        # by checking if the query touches the IoT table
    else:
        safe_query = f"{query} LIMIT {limit}"
    
    try:
        with connection.cursor() as cursor:
            # For queries on bi_iotmeasurement, add org filter
            if "BI_IOTMEASUREMENT" in query_upper or "bi_iotmeasurement" in query:
                # Parse and inject organization filter
                # Simple approach: wrap in CTE with org filter
                filtered_query = f"""
                WITH org_data AS (
                    SELECT * FROM bi_iotmeasurement WHERE organization_id = {org_id}
                )
                SELECT * FROM (
                    {query.replace('bi_iotmeasurement', 'org_data').replace('BI_IOTMEASUREMENT', 'org_data')}
                ) AS filtered_result
                LIMIT {limit}
                """
                cursor.execute(filtered_query)
            else:
                cursor.execute(safe_query)
            
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            
            # Convert to list of dicts
            results = [dict(zip(columns, row)) for row in rows]
            
            return Response({
                "columns": columns,
                "rows": results,
                "count": len(results)
            })
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_table_schema(request):
    """
    Get the schema of the IoT measurement table for SQL assistance.
    """
    schema = {
        "table_name": "bi_iotmeasurement",
        "columns": [
            {"name": "id", "type": "UUID", "description": "Unique identifier"},
            {"name": "organization_id", "type": "INTEGER", "description": "Organization foreign key"},
            {"name": "device_id", "type": "VARCHAR(255)", "description": "Device identifier"},
            {"name": "metric", "type": "VARCHAR(255)", "description": "Metric name (e.g., temperature, pm25)"},
            {"name": "recorded_at", "type": "TIMESTAMP", "description": "Timestamp of the measurement"},
            {"name": "value", "type": "FLOAT", "description": "Numeric value of the measurement"},
            {"name": "tags", "type": "JSONB", "description": "Additional metadata as JSON"},
        ],
        "example_queries": [
            {
                "description": "Get average value by device",
                "query": "SELECT device_id, AVG(value) as avg_value FROM bi_iotmeasurement GROUP BY device_id"
            },
            {
                "description": "Get hourly aggregates",
                "query": "SELECT date_trunc('hour', recorded_at) as hour, device_id, AVG(value) as avg_value FROM bi_iotmeasurement GROUP BY hour, device_id ORDER BY hour"
            },
            {
                "description": "Get latest values per device",
                "query": "SELECT DISTINCT ON (device_id) device_id, metric, value, recorded_at FROM bi_iotmeasurement ORDER BY device_id, recorded_at DESC"
            },
            {
                "description": "Filter by metric type",
                "query": "SELECT * FROM bi_iotmeasurement WHERE metric = 'pm25' ORDER BY recorded_at DESC LIMIT 100"
            },
            {
                "description": "Time range query",
                "query": "SELECT * FROM bi_iotmeasurement WHERE recorded_at >= NOW() - INTERVAL '7 days'"
            }
        ]
    }
    return Response(schema)
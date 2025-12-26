from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
import csv
import io

from .models import Dashboard, Indicator, Workspace, IoTMeasurement
from .serializers import (
    DashboardSerializer,
    IndicatorSerializer,
    WorkspaceSerializer,
    IoTMeasurementSerializer,
)

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
        Accepts either JSON array of measurements or CSV file upload.
        
        JSON body formats supported:
        
        1. Standard format with rows:
        {
          "device_id": "dev-1",
          "metric": "temperature",
          "rows": [
            {"recorded_at": "2025-01-01T00:00:00Z", "value": 23.1, "tags": {"room": "A"}},
            ...
          ]
        }
        
        2. OpenAQ-style array format (air-quality samples):
        [
          {
            "location": "Coyhaique",
            "parameter": "pm25",
            "date": {"utc": "2028-07-01T22:00:00.000Z"},
            "value": 1,
            "unit": "µg/m³",
            "coordinates": {"latitude": -45.57, "longitude": -72.06},
            "country": "CL",
            "city": "Coyhaique"
          },
          ...
        ]

        CSV upload expects columns: device_id, metric, recorded_at, value, tags(optional JSON)
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

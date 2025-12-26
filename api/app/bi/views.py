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
        JSON body example:
        {
          "device_id": "dev-1",
          "metric": "temperature",
          "rows": [
            {"recorded_at": "2025-01-01T00:00:00Z", "value": 23.1, "tags": {"room": "A"}},
            ...
          ]
        }

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
            device_id = request.data.get("device_id", "").strip() if isinstance(request.data.get("device_id"), str) else ""
            metric = request.data.get("metric", "").strip() if isinstance(request.data.get("metric"), str) else ""
            rows = request.data.get("rows", [])
            
            if not rows:
                return Response(
                    {"error": "No rows provided for ingestion"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            objs = []
            for r in rows:
                row_device = (r.get("device_id") or device_id or "").strip()
                row_metric = (r.get("metric") or metric or "").strip()
                row_recorded_at = r.get("recorded_at")
                
                if not row_device or not row_metric or not row_recorded_at:
                    continue  # Skip rows with missing required fields
                
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
                created = len(objs)

        return Response({"created": created}, status=status.HTTP_201_CREATED)

    def _safe_json(self, raw):
        if not raw:
            return {}
        try:
            import json

            return json.loads(raw)
        except Exception:
            return {}

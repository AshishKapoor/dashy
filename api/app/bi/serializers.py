from rest_framework import serializers

from .models import (
    Dashboard,
    DashboardIndicator,
    Indicator,
    IndicatorValue,
    Workspace,
    IoTMeasurement,
    IngestionJob,
)

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = "__all__"


class DashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dashboard
        fields = "__all__"


class IndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Indicator
        fields = "__all__"


class IndicatorValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndicatorValue
        fields = "__all__"


class DashboardIndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardIndicator
        fields = "__all__"


class IoTMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = IoTMeasurement
        fields = "__all__"


class IngestionJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestionJob
        fields = [
            "id",
            "organization",
            "created_by",
            "source_type",
            "file_name",
            "status",
            "progress",
            "total_rows",
            "processed_rows",
            "failed_rows",
            "error_message",
            "logs",
            "created_at",
            "started_at",
            "finished_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "created_by",
            "status",
            "progress",
            "total_rows",
            "processed_rows",
            "failed_rows",
            "error_message",
            "logs",
            "created_at",
            "started_at",
            "finished_at",
        ]


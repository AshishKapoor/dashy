from rest_framework import serializers

from .models import (
    Dashboard,
    DashboardIndicator,
    Indicator,
    IndicatorValue,
    Workspace,
    IoTMeasurement,
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

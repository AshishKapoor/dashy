import os
import time
import uuid
from django.db import models

from app.accounts.models import Organization, User


def uuid7_like():
    """Generate a UUIDv7-compatible identifier for time-partitioned IDs."""
    # Layout per draft: 60-bit Unix time in ms, version 7 nibble, 2-bit variant, 62-bit randomness.
    millis = int(time.time() * 1000)
    time_high = (millis & ((1 << 48) - 1))  # lower 48 bits
    rand_bits = int.from_bytes(os.urandom(10), "big")  # 80 random bits

    # Compose most-significant 64 bits: 48 bits time, 4 bits version (0111), 12 bits rand
    msb = (time_high << 16) | (0x7 << 12) | ((rand_bits >> 68) & 0x0FFF)

    # Least-significant 64 bits: remaining 62 random bits + variant (10xx)
    lsb_random = rand_bits & ((1 << 62) - 1)
    lsb = (0x2 << 62) | lsb_random

    return uuid.UUID(int=((msb << 64) | lsb))

class Workspace(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="workspaces")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)


class Dashboard(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="dashboards")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=100)
    config = models.JSONField(default=dict)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)


class IndicatorCategory(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)


class Indicator(models.Model):
    category = models.ForeignKey(IndicatorCategory, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    formula = models.TextField()
    frequency = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)


class IndicatorValue(models.Model):
    indicator = models.ForeignKey(Indicator, on_delete=models.CASCADE, related_name="values")
    recorded_at = models.DateField()
    value = models.FloatField()


class DashboardIndicator(models.Model):
    dashboard = models.ForeignKey(Dashboard, on_delete=models.CASCADE, related_name="items")
    indicator = models.ForeignKey(Indicator, on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)


class IoTMeasurement(models.Model):
    """
    Generic IoT time-series measurement stored as a TimescaleDB hypertable.
    Columns represent common tags and fields for IoT data.
    """
    id = models.UUIDField(primary_key=True, default=uuid7_like, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="iot_measurements")
    device_id = models.CharField(max_length=255)
    metric = models.CharField(max_length=255)
    recorded_at = models.DateTimeField(db_index=True)
    value = models.FloatField(null=True)
    tags = models.JSONField(blank=True, null=True, default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "device_id", "metric", "recorded_at"]),
        ]


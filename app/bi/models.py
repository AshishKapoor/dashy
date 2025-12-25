from django.db import models

from app.accounts.models import Organization, User

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

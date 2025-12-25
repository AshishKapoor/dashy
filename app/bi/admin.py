from django.contrib import admin

from .models import (
    Dashboard,
    DashboardIndicator,
    Indicator,
    IndicatorCategory,
    IndicatorValue,
    Workspace,
)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ["name", "organization"]
    list_filter = ["organization"]
    search_fields = ["name", "description"]


@admin.register(Dashboard)
class DashboardAdmin(admin.ModelAdmin):
    list_display = ["name", "workspace", "type", "created_by"]
    list_filter = ["workspace", "type"]
    search_fields = ["name"]


@admin.register(IndicatorCategory)
class IndicatorCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "organization"]
    list_filter = ["organization"]
    search_fields = ["name"]


@admin.register(Indicator)
class IndicatorAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "frequency", "owner"]
    list_filter = ["category", "frequency"]
    search_fields = ["name", "formula"]


@admin.register(IndicatorValue)
class IndicatorValueAdmin(admin.ModelAdmin):
    list_display = ["indicator", "recorded_at", "value"]
    list_filter = ["indicator", "recorded_at"]
    search_fields = ["indicator__name"]
    date_hierarchy = "recorded_at"


@admin.register(DashboardIndicator)
class DashboardIndicatorAdmin(admin.ModelAdmin):
    list_display = ["dashboard", "indicator", "position"]
    list_filter = ["dashboard"]
    search_fields = ["dashboard__name", "indicator__name"]


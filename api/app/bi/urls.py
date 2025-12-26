from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DashboardViewSet, IndicatorViewSet, WorkspaceViewSet, IoTMeasurementViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register("workspaces", WorkspaceViewSet)
router.register("dashboards", DashboardViewSet)
router.register("indicators", IndicatorViewSet)
router.register("iot", IoTMeasurementViewSet)

urlpatterns = [
    path("", include(router.urls)),
]

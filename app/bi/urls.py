from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DashboardViewSet, IndicatorViewSet, WorkspaceViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register("workspaces", WorkspaceViewSet)
router.register("dashboards", DashboardViewSet)
router.register("indicators", IndicatorViewSet)

urlpatterns = [
    path("", include(router.urls)),
]

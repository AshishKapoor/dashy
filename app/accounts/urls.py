from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MembershipViewSet, OrganizationViewSet, RoleViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register("organizations", OrganizationViewSet)
router.register("roles", RoleViewSet)
router.register("memberships", MembershipViewSet)

urlpatterns = [
    path("", include(router.urls)),
]

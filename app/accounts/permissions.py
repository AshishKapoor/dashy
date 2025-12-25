from rest_framework.permissions import BasePermission

class IsOrgAdmin(BasePermission):
    """Only allow Admin role for the user's org."""

    def has_permission(self, request, view):
        memb = getattr(request.user, "membership_set", None)
        if not memb:
            return False
        return memb.filter(role__name="Admin").exists()

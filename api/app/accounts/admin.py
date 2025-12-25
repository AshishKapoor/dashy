from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Membership, Organization, Role, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "first_name", "last_name", "organization", "is_staff"]
    search_fields = ["username", "email", "first_name", "last_name"]
    list_filter = ["organization", "is_staff", "is_superuser"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Organization", {"fields": ("organization", "designation", "timezone")}),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "domain"]
    search_fields = ["name", "domain"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "organization"]
    list_filter = ["organization"]
    search_fields = ["name"]
    filter_horizontal = ["permissions"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role"]
    list_filter = ["organization", "role"]
    search_fields = ["user__username", "user__email", "organization__name"]


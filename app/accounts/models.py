from django.db import models
from django.contrib.auth.models import AbstractUser, Permission
from django.conf import settings

class Organization(models.Model):
    name = models.CharField(max_length=255, unique=True)
    domain = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    # Inherit all fields from AbstractUser
    organization = models.ForeignKey(
        Organization,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users"
    )
    designation = models.CharField(max_length=255, blank=True, null=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)


class Role(models.Model):
    """
    Role is scoped per organization.
    e.g. 'Admin' in Org A is not 'Admin' in Org B
    """
    name = models.CharField(max_length=200)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="roles")
    permissions = models.ManyToManyField(Permission, blank=True)

    class Meta:
        unique_together = ('name', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"


class Membership(models.Model):
    """Link user to organization with a specific role."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'organization')

    def __str__(self):
        return f"{self.user.username} -> {self.role.name}@{self.organization.name}"

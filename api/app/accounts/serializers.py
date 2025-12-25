from rest_framework import serializers
from .models import User, Organization, Role, Membership

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ["password", "groups", "user_permissions"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = "__all__"


class MembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Membership
        fields = "__all__"

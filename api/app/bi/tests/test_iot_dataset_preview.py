"""
Tests for IoT Dataset Preview functionality
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from app.accounts.models import User, Organization
from app.bi.models import IoTMeasurement
from datetime import datetime, timezone


class IoTDatasetPreviewTestCase(TestCase):
    """Test the Dataset Preview API endpoints"""

    def setUp(self):
        """Set up test client and test data"""
        self.client = APIClient()
        
        # Create organization and user
        self.org = Organization.objects.create(name="Test Org")
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass",
            organization=self.org
        )
        
        # Authenticate
        self.client.force_authenticate(user=self.user)
        
        # Create test measurements
        self.measurements = [
            IoTMeasurement.objects.create(
                organization=self.org,
                device_id="sensor-001",
                metric="temperature",
                recorded_at=datetime(2025, 12, 27, 10, 0, 0, tzinfo=timezone.utc),
                value=23.5,
                tags={"location": "room-A"}
            ),
            IoTMeasurement.objects.create(
                organization=self.org,
                device_id="sensor-001",
                metric="humidity",
                recorded_at=datetime(2025, 12, 27, 10, 5, 0, tzinfo=timezone.utc),
                value=65.0,
                tags={"location": "room-A"}
            ),
            IoTMeasurement.objects.create(
                organization=self.org,
                device_id="sensor-002",
                metric="temperature",
                recorded_at=datetime(2025, 12, 27, 10, 10, 0, tzinfo=timezone.utc),
                value=22.1,
                tags={"location": "room-B"}
            ),
        ]

    def test_list_all_measurements(self):
        """Test listing all measurements without filters"""
        response = self.client.get("/api/bi/iot/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        
        # Verify ordering (most recent first)
        self.assertEqual(response.data[0]["device_id"], "sensor-002")
        self.assertEqual(response.data[1]["device_id"], "sensor-001")
        self.assertEqual(response.data[2]["device_id"], "sensor-001")

    def test_filter_by_device_id(self):
        """Test filtering by device_id"""
        response = self.client.get("/api/bi/iot/?device_id=sensor-001")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        for item in response.data:
            self.assertEqual(item["device_id"], "sensor-001")

    def test_filter_by_metric(self):
        """Test filtering by metric"""
        response = self.client.get("/api/bi/iot/?metric=temperature")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        for item in response.data:
            self.assertEqual(item["metric"], "temperature")

    def test_filter_by_device_and_metric(self):
        """Test filtering by both device_id and metric"""
        response = self.client.get(
            "/api/bi/iot/?device_id=sensor-001&metric=temperature"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["device_id"], "sensor-001")
        self.assertEqual(response.data[0]["metric"], "temperature")
        self.assertEqual(response.data[0]["value"], 23.5)

    def test_empty_result_with_non_existent_filter(self):
        """Test that non-existent filters return empty list"""
        response = self.client.get("/api/bi/iot/?device_id=non-existent")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_response_includes_all_fields(self):
        """Test that response includes all required fields"""
        response = self.client.get("/api/bi/iot/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first_item = response.data[0]
        
        # Verify all fields present
        self.assertIn("id", first_item)
        self.assertIn("organization", first_item)
        self.assertIn("device_id", first_item)
        self.assertIn("metric", first_item)
        self.assertIn("recorded_at", first_item)
        self.assertIn("value", first_item)
        self.assertIn("tags", first_item)

    def test_tags_are_json_objects(self):
        """Test that tags are properly serialized as JSON"""
        response = self.client.get("/api/bi/iot/?device_id=sensor-001")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first_item = response.data[0]
        
        self.assertIsInstance(first_item["tags"], dict)
        self.assertIn("location", first_item["tags"])

    def test_org_scoping_prevents_cross_org_access(self):
        """Test that users can only see their org's data"""
        # Create another org and measurements
        other_org = Organization.objects.create(name="Other Org")
        IoTMeasurement.objects.create(
            organization=other_org,
            device_id="sensor-999",
            metric="pressure",
            recorded_at=datetime(2025, 12, 27, 11, 0, 0, tzinfo=timezone.utc),
            value=1013.25,
        )
        
        response = self.client.get("/api/bi/iot/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see 3 measurements from Test Org
        self.assertEqual(len(response.data), 3)
        
        # Verify no sensor-999 in results
        device_ids = [item["device_id"] for item in response.data]
        self.assertNotIn("sensor-999", device_ids)

    def test_ingest_and_preview_workflow(self):
        """Test complete workflow: ingest data then preview it"""
        # Ingest new data
        ingest_response = self.client.post(
            "/api/bi/iot/ingest/",
            {
                "device_id": "sensor-003",
                "metric": "pressure",
                "rows": [
                    {
                        "recorded_at": "2025-12-27T12:00:00Z",
                        "value": 1013.5,
                        "tags": {"floor": 2}
                    },
                    {
                        "recorded_at": "2025-12-27T12:05:00Z",
                        "value": 1014.0,
                        "tags": {"floor": 2}
                    }
                ]
            },
            format="json"
        )
        
        self.assertEqual(ingest_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ingest_response.data["created"], 2)
        
        # Preview the data
        preview_response = self.client.get("/api/bi/iot/?device_id=sensor-003")
        
        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(preview_response.data), 2)
        self.assertEqual(preview_response.data[0]["device_id"], "sensor-003")
        self.assertEqual(preview_response.data[0]["metric"], "pressure")
        self.assertEqual(preview_response.data[0]["value"], 1014.0)  # Most recent first

    def test_null_values_handled_correctly(self):
        """Test that null values are properly handled"""
        # Create measurement with null value
        IoTMeasurement.objects.create(
            organization=self.org,
            device_id="sensor-004",
            metric="status",
            recorded_at=datetime(2025, 12, 27, 13, 0, 0, tzinfo=timezone.utc),
            value=None,
        )
        
        response = self.client.get("/api/bi/iot/?device_id=sensor-004")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0]["value"])

    def test_empty_tags_handled_correctly(self):
        """Test that empty tags are properly handled"""
        # Create measurement with no tags
        IoTMeasurement.objects.create(
            organization=self.org,
            device_id="sensor-005",
            metric="voltage",
            recorded_at=datetime(2025, 12, 27, 14, 0, 0, tzinfo=timezone.utc),
            value=3.3,
            tags=None,
        )
        
        response = self.client.get("/api/bi/iot/?device_id=sensor-005")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        # tags should be None or empty dict
        self.assertTrue(
            response.data[0]["tags"] is None or response.data[0]["tags"] == {}
        )

    def test_large_dataset_pagination_not_needed(self):
        """Test that large datasets are returned without pagination"""
        # Create many measurements
        for i in range(50):
            IoTMeasurement.objects.create(
                organization=self.org,
                device_id=f"sensor-bulk-{i % 5}",
                metric="test_metric",
                recorded_at=datetime(2025, 12, 27, 15, i, 0, tzinfo=timezone.utc),
                value=float(i),
            )
        
        response = self.client.get("/api/bi/iot/?metric=test_metric")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # All 50 measurements should be returned
        self.assertEqual(len(response.data), 50)

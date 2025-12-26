from django.utils.timezone import now
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from app.accounts.models import Organization, User
from app.bi.models import IoTMeasurement


class IoTIngestionTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        # Create two orgs and users
        self.org1 = Organization.objects.create(name="Org One")
        self.org2 = Organization.objects.create(name="Org Two")

        self.user1 = User.objects.create_user(
            username="alice", password="password", organization=self.org1
        )
        self.user2 = User.objects.create_user(
            username="bob", password="password", organization=self.org2
        )

    def _auth_as(self, user: User):
        self.client.force_authenticate(user=user)

    def test_auth_required(self):
        # Unauthenticated should be 401
        resp = self.client.get("/api/bi/iot/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ingest_json_with_defaults(self):
        self._auth_as(self.user1)
        payload = {
            "device_id": "dev-1",
            "metric": "temperature",
            "rows": [
                {
                    "recorded_at": now().isoformat(),
                    "value": 23.5,
                    "tags": {"room": "A"},
                },
                {
                    "recorded_at": now().isoformat(),
                    "value": 24.1,
                },
            ],
        }

        resp = self.client.post("/api/bi/iot/ingest/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get("created"), 2)

        # Verify rows persisted and scoped to org1
        qs = IoTMeasurement.objects.filter(organization=self.org1)
        self.assertEqual(qs.count(), 2)
        for m in qs:
            self.assertEqual(m.device_id, "dev-1")
            self.assertEqual(m.metric, "temperature")

    def test_ingest_json_per_row_fields(self):
        self._auth_as(self.user1)
        payload = {
            "rows": [
                {
                    "device_id": "dev-2",
                    "metric": "humidity",
                    "recorded_at": now().isoformat(),
                    "value": 55.0,
                },
                {
                    "device_id": "dev-3",
                    "metric": "humidity",
                    "recorded_at": now().isoformat(),
                    "value": 60.0,
                    "tags": {"zone": "west"},
                },
            ]
        }

        resp = self.client.post("/api/bi/iot/ingest/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get("created"), 2)

        qs = IoTMeasurement.objects.filter(organization=self.org1).order_by("recorded_at")
        self.assertEqual(qs.count(), 2)
        self.assertIn(qs[0].device_id, {"dev-2", "dev-3"})
        self.assertEqual(qs[0].metric, "humidity")

    def test_ingest_csv_upload(self):
        self._auth_as(self.user1)
        date1 = now().isoformat()
        date2 = now().isoformat()
        csv_content = (
            "device_id,metric,recorded_at,value,tags\n"
            f"dev-4,temperature,{date1},21.2,{{\"room\": \"B\"}}\n"
            f"dev-5,temperature,{date2},19.8,\n"
        ).encode("utf-8")

        upload = SimpleUploadedFile("data.csv", csv_content, content_type="text/csv")

        resp = self.client.post("/api/bi/iot/ingest/", {"file": upload}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get("created"), 2)

        qs = IoTMeasurement.objects.filter(organization=self.org1)
        self.assertEqual(qs.count(), 2)
        self.assertEqual(set(qs.values_list("device_id", flat=True)), {"dev-4", "dev-5"})

    def test_list_filters_and_ordering(self):
        # Seed cross-org data
        IoTMeasurement.objects.create(
            organization=self.org1,
            device_id="dev-6",
            metric="pressure",
            recorded_at=now(),
            value=101.1,
        )
        IoTMeasurement.objects.create(
            organization=self.org1,
            device_id="dev-6",
            metric="pressure",
            recorded_at=now(),
            value=100.9,
        )
        IoTMeasurement.objects.create(
            organization=self.org2,
            device_id="dev-6",
            metric="pressure",
            recorded_at=now(),
            value=99.9,
        )

        self._auth_as(self.user1)

        # Filter by device_id and metric, ensure org scoping and ordering desc by recorded_at
        resp = self.client.get("/api/bi/iot/", {"device_id": "dev-6", "metric": "pressure"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(len(data), 2)
        # Confirm ordering by recorded_at descending
        self.assertGreaterEqual(data[0]["recorded_at"], data[1]["recorded_at"])  # string compare isoformat

    def test_org_scoping(self):
        # User1 creates one, User2 should not see it
        self._auth_as(self.user1)
        payload = {
            "device_id": "dev-7",
            "metric": "temp",
            "rows": [{"recorded_at": now().isoformat(), "value": 25.0}],
        }
        resp = self.client.post("/api/bi/iot/ingest/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Switch to user2
        self._auth_as(self.user2)
        resp2 = self.client.get("/api/bi/iot/")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp2.json()), 0)

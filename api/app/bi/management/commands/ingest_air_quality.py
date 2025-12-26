import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_datetime

from app.accounts.models import Organization
from app.bi.models import IoTMeasurement


class Command(BaseCommand):
    help = "Ingest sample air-quality JSON into IoTMeasurement"

    def add_arguments(self, parser):
        default_path = Path(settings.BASE_DIR).parent / "samples" / "air-quality" / "sample.json"
        parser.add_argument(
            "--file",
            dest="file_path",
            default=str(default_path),
            help="Path to the air quality JSON file (default: samples/air-quality/sample.json)",
        )
        parser.add_argument(
            "--org-id",
            dest="org_id",
            type=int,
            default=None,
            help="Organization ID to ingest into",
        )
        parser.add_argument(
            "--org-name",
            dest="org_name",
            default="Demo Org",
            help="Organization name to use or create if org-id not provided",
        )
        parser.add_argument(
            "--batch-size",
            dest="batch_size",
            type=int,
            default=1000,
            help="Batch size for bulk insert",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file_path"])
        batch_size = options["batch_size"]

        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")

        org = self._resolve_org(options)
        self.stdout.write(self.style.NOTICE(f"Using organization: {org.name} (id={org.id})"))

        with file_path.open() as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as exc:
                raise CommandError(f"Invalid JSON: {exc}") from exc

        if not isinstance(data, list):
            raise CommandError("Expected top-level JSON array")

        rows = []
        for item in data:
            recorded_at = parse_datetime(item.get("date", {}).get("utc"))
            if not recorded_at:
                continue
            rows.append(
                IoTMeasurement(
                    organization=org,
                    device_id=item.get("location", "unknown"),
                    metric=item.get("parameter", "unknown"),
                    recorded_at=recorded_at,
                    value=item.get("value"),
                    tags={
                        "unit": item.get("unit"),
                        "country": item.get("country"),
                        "city": item.get("city"),
                        "coordinates": item.get("coordinates"),
                        "location": item.get("location"),
                    },
                )
            )

        if not rows:
            self.stdout.write(self.style.WARNING("No valid rows to ingest."))
            return

        IoTMeasurement.objects.bulk_create(rows, batch_size=batch_size, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f"Ingested {len(rows)} IoT measurements."))

    def _resolve_org(self, options):
        org_id = options.get("org_id")
        if org_id:
            try:
                return Organization.objects.get(id=org_id)
            except Organization.DoesNotExist as exc:
                raise CommandError(f"Organization id {org_id} not found") from exc

        org_name = options.get("org_name") or "Demo Org"
        org, _ = Organization.objects.get_or_create(name=org_name)
        return org

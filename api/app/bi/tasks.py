"""
Celery tasks for background data ingestion.
"""
import csv
import io
import json
import os
import traceback

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import IngestionJob, IoTMeasurement


# Column name mappings for flexible CSV parsing
DEVICE_ID_COLUMNS = ["device_id", "deviceid", "device", "location", "sensor", "sensor_id", "name"]
METRIC_COLUMNS = ["metric", "parameter", "measurement", "type", "metric_name"]
TIMESTAMP_COLUMNS = ["recorded_at", "timestamp", "time", "datetime", "date", "created_at"]
VALUE_COLUMNS = ["value", "reading", "measurement", "amount"]
SKIP_KEYS = set(DEVICE_ID_COLUMNS + METRIC_COLUMNS + TIMESTAMP_COLUMNS + VALUE_COLUMNS + ["tags"])


def _log(job: IngestionJob, message: str):
    """Append a timestamped log entry to the job."""
    timestamp = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
    job.logs += f"[{timestamp}] {message}\n"
    job.save(update_fields=["logs"])


def _update_progress(job: IngestionJob, processed: int, total: int):
    """Update job progress."""
    job.processed_rows = processed
    job.total_rows = total
    job.progress = int((processed / total) * 100) if total > 0 else 0
    job.save(update_fields=["processed_rows", "total_rows", "progress"])


def _get_first_match(row_dict: dict, columns: list, default: str = "") -> str:
    """Get the first matching value from a list of possible column names."""
    for col in columns:
        val = row_dict.get(col)
        if val:
            return str(val).strip()
    return default


def _parse_openaq_format(data: list, org) -> list:
    """
    Parse OpenAQ-style JSON array format.
    Example:
    [
      {
        "location": "Coyhaique",
        "parameter": "pm25",
        "date": {"utc": "2028-07-01T22:00:00.000Z"},
        "value": 1,
        "unit": "µg/m³",
        "coordinates": {"latitude": -45.57, "longitude": -72.06},
        "country": "CL",
        "city": "Coyhaique"
      }
    ]
    """
    objs = []
    for item in data:
        device_id = str(item.get("location", "")).strip()
        metric = str(item.get("parameter", "")).strip()
        
        # Handle date - can be nested or direct
        date_obj = item.get("date", {})
        recorded_at = date_obj.get("utc") or date_obj.get("local") if isinstance(date_obj, dict) else date_obj
        
        if not device_id or not metric or not recorded_at:
            continue
        
        # Build tags from available metadata
        tags = {key: item[key] for key in ["city", "country", "unit", "location", "coordinates"] 
                if key in item and item[key] is not None}
        
        objs.append(
            IoTMeasurement(
                organization=org,
                device_id=device_id,
                metric=metric,
                recorded_at=recorded_at,
                value=item.get("value"),
                tags=tags,
            )
        )
    return objs


def _parse_standard_format(data: dict, org) -> list:
    """
    Parse standard format with device_id, metric, rows.
    Example:
    {
      "device_id": "dev-1",
      "metric": "temperature",
      "rows": [
        {"recorded_at": "2025-01-01T00:00:00Z", "value": 23.1, "tags": {"room": "A"}}
      ]
    }
    """
    objs = []
    device_id = str(data.get("device_id", "")).strip()
    metric = str(data.get("metric", "")).strip()
    rows = data.get("rows", [])
    
    for r in rows:
        row_device = str(r.get("device_id") or device_id or "").strip()
        row_metric = str(r.get("metric") or metric or "").strip()
        row_recorded_at = r.get("recorded_at")
        
        if not row_device or not row_metric or not row_recorded_at:
            continue
        
        objs.append(
            IoTMeasurement(
                organization=org,
                device_id=row_device,
                metric=row_metric,
                recorded_at=row_recorded_at,
                value=r.get("value"),
                tags=r.get("tags", {}),
            )
        )
    return objs


def _parse_csv_row(row_lower: dict, org) -> IoTMeasurement | None:
    """Parse a single CSV row into an IoTMeasurement object."""
    device_id = _get_first_match(row_lower, DEVICE_ID_COLUMNS)
    recorded_at = _get_first_match(row_lower, TIMESTAMP_COLUMNS)
    
    if not device_id or not recorded_at:
        return None
    
    metric = _get_first_match(row_lower, METRIC_COLUMNS, "unknown")
    value_str = _get_first_match(row_lower, VALUE_COLUMNS)
    
    # Parse value
    value = None
    if value_str:
        try:
            value = float(value_str)
        except (ValueError, TypeError):
            pass
    
    # Build tags from remaining columns
    tags = {key: val for key, val in row_lower.items() if key not in SKIP_KEYS and val}
    
    # Try to parse tags column if present
    tags_str = row_lower.get("tags", "")
    if tags_str:
        try:
            parsed_tags = json.loads(tags_str)
            if isinstance(parsed_tags, dict):
                tags.update(parsed_tags)
        except (json.JSONDecodeError, TypeError):
            pass
    
    return IoTMeasurement(
        organization=org,
        device_id=device_id,
        metric=metric,
        recorded_at=recorded_at,
        value=value,
        tags=tags if tags else None,
    )


def _parse_generic_csv(content: str, org) -> list:
    """
    Parse CSV with flexible column mapping.
    Tries to map common column names to our schema.
    """
    objs = []
    reader = csv.DictReader(io.StringIO(content))
    
    for row in reader:
        row_lower = {k.lower(): v for k, v in row.items()}
        measurement = _parse_csv_row(row_lower, org)
        if measurement:
            objs.append(measurement)
    
    return objs


def _parse_json_content(content: str, org, job: IngestionJob) -> list:
    """Parse JSON content and return list of IoTMeasurement objects."""
    data = json.loads(content)
    
    if isinstance(data, list):
        _log(job, f"Detected array format with {len(data)} items")
        return _parse_openaq_format(data, org)
    
    if isinstance(data, dict):
        if "rows" in data:
            _log(job, "Detected standard format with rows")
            return _parse_standard_format(data, org)
        _log(job, "Detected single object, treating as array")
        return _parse_openaq_format([data], org)
    
    raise ValueError(f"Unsupported JSON structure: {type(data)}")


def _bulk_insert_measurements(objs: list, job: IngestionJob, batch_size: int = 1000) -> tuple[int, int]:
    """Bulk insert measurements in batches. Returns (created, failed) counts."""
    total_rows = len(objs)
    created = 0
    failed = 0
    
    for i in range(0, total_rows, batch_size):
        batch = objs[i:i + batch_size]
        try:
            with transaction.atomic():
                IoTMeasurement.objects.bulk_create(batch, batch_size=batch_size, ignore_conflicts=True)
            created += len(batch)
        except Exception as e:
            _log(job, f"Batch {i // batch_size + 1} failed: {e!s}")
            failed += len(batch)
        
        _update_progress(job, created + failed, total_rows)
    
    return created, failed


def _cleanup_temp_file(file_path: str | None, job: IngestionJob):
    """Clean up temporary file if it exists."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            _log(job, "Cleaned up temporary file")
        except OSError:
            pass


@shared_task(bind=True)
def process_ingestion_job(self, job_id: str):
    """
    Process a data ingestion job in the background.
    """
    try:
        job = IngestionJob.objects.get(id=job_id)
    except IngestionJob.DoesNotExist:
        return {"error": f"Job {job_id} not found"}
    
    # Update status to processing
    job.status = "processing"
    job.started_at = timezone.now()
    job.celery_task_id = self.request.id
    job.save()
    _log(job, f"Started processing {job.source_type} file: {job.file_name}")
    
    try:
        org = job.organization
        if not org:
            raise ValueError("Job has no associated organization")
        
        if not job.file_path or not os.path.exists(job.file_path):
            raise FileNotFoundError(f"File not found: {job.file_path}")
        
        with open(job.file_path, encoding="utf-8") as f:
            content = f.read()
        
        _log(job, f"Read {len(content)} bytes from file")
        
        # Parse content based on source type
        if job.source_type == "json":
            objs = _parse_json_content(content, org, job)
        elif job.source_type == "csv":
            _log(job, "Parsing CSV content")
            objs = _parse_generic_csv(content, org)
        else:
            raise ValueError(f"Unsupported source type: {job.source_type}")
        
        total_rows = len(objs)
        _log(job, f"Parsed {total_rows} valid records")
        job.total_rows = total_rows
        job.save(update_fields=["total_rows"])
        
        if total_rows == 0:
            job.status = "completed"
            job.progress = 100
            job.finished_at = timezone.now()
            job.save()
            _log(job, "No valid records found to insert")
            return {"created": 0, "job_id": str(job.id)}
        
        # Bulk insert in batches
        created, failed = _bulk_insert_measurements(objs, job)
        
        _cleanup_temp_file(job.file_path, job)
        
        # Update final status
        job.status = "completed"
        job.progress = 100
        job.processed_rows = created
        job.failed_rows = failed
        job.finished_at = timezone.now()
        job.save()
        _log(job, f"Completed: {created} records created, {failed} failed")
        
        return {"created": created, "failed": failed, "job_id": str(job.id)}
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.finished_at = timezone.now()
        job.save()
        _log(job, f"Error: {e!s}\n{traceback.format_exc()}")
        _cleanup_temp_file(job.file_path, job)
        return {"error": str(e), "job_id": str(job.id)}

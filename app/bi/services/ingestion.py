import csv
import requests
import datetime
from django.utils.timezone import now

def run_ingestion(job):
    datasource = job.datasource
    cfg = datasource.config
    job.status = "running"
    job.logs = f"Started at {now()}\n"
    job.save()

    try:
        if datasource.source_type == "csv":
            ingest_csv(cfg, job)
        elif datasource.source_type == "api":
            ingest_api(cfg, job)
        elif datasource.source_type == "gsheet":
            ingest_gsheet(cfg, job)
        else:
            raise ValueError("Unknown source type")

        job.status = "completed"
    except Exception as e:
        job.status = "failed"
        job.logs += f"\nError: {e}"
    finally:
        job.finished_at = now()
        job.save()


def ingest_csv(config, job):
    """Expect config: { 'path': '/path/to/file.csv' }"""
    path = config.get("path")
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # TODO: Map to IndicatorValue or DataModel
            pass
    job.logs += "\nCSV ingestion completed."


def ingest_api(config, job):
    """Expect config: { 'url': 'https://api.com/data', 'auth': 'token123' }"""
    headers = {}
    if config.get("auth"):
        headers["Authorization"] = f"Bearer {config['auth']}"
    resp = requests.get(config["url"], headers=headers)
    data = resp.json()
    # TODO: Map JSON to our models
    job.logs += "\nAPI ingestion completed."


def ingest_gsheet(config, job):
    """
    Expect config: { 'sheet_id': '...', 'api_key': '...' }
    Hint: use Google Sheets API later
    """
    sheet_id = config.get("sheet_id")
    job.logs += f"\nWould fetch Google Sheet: {sheet_id}"

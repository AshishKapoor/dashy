from django.db import migrations, models
import django.db.models.deletion


def run_timescaledb_setup(apps, schema_editor):
    """Run TimescaleDB-specific SQL only on PostgreSQL."""
    if schema_editor.connection.vendor != "postgresql":
        return
    
    cursor = schema_editor.connection.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
    cursor.execute("ALTER TABLE bi_iotmeasurement ALTER COLUMN id SET DEFAULT generate_uuidv7();")
    cursor.execute(
        "SELECT create_hypertable('bi_iotmeasurement', by_range('id', INTERVAL '1 month'), if_not_exists => TRUE);"
    )


def reverse_timescaledb_setup(apps, schema_editor):
    """Reverse TimescaleDB-specific changes only on PostgreSQL."""
    if schema_editor.connection.vendor != "postgresql":
        return
    
    cursor = schema_editor.connection.cursor()
    cursor.execute("ALTER TABLE bi_iotmeasurement ALTER COLUMN id DROP DEFAULT;")


class Migration(migrations.Migration):
    dependencies = [
        ("bi", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="IoTMeasurement",
            fields=[
                (
                    "id",
                    models.UUIDField(primary_key=True, editable=False),
                ),
                (
                    "device_id",
                    models.CharField(max_length=255),
                ),
                (
                    "metric",
                    models.CharField(max_length=255),
                ),
                (
                    "recorded_at",
                    models.DateTimeField(db_index=True),
                ),
                (
                    "value",
                    models.FloatField(null=True),
                ),
                (
                    "tags",
                    models.JSONField(blank=True, null=True, default=dict),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="iot_measurements",
                        to="accounts.organization",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="iotmeasurement",
            index=models.Index(
                fields=["organization", "device_id", "metric", "recorded_at"],
                name="bi_iot_idx",
            ),
        ),
        migrations.RunPython(run_timescaledb_setup, reverse_timescaledb_setup),
    ]

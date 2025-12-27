# Generated migration for IngestionJob model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import app.bi.models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('bi', '0003_use_uuid7_like_default'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='IngestionJob',
            fields=[
                ('id', models.UUIDField(default=app.bi.models.uuid7_like, editable=False, primary_key=True, serialize=False)),
                ('source_type', models.CharField(choices=[('json', 'JSON'), ('csv', 'CSV'), ('api', 'API')], max_length=20)),
                ('file_name', models.CharField(blank=True, max_length=500, null=True)),
                ('file_path', models.CharField(blank=True, max_length=1000, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('progress', models.IntegerField(default=0)),
                ('total_rows', models.IntegerField(default=0)),
                ('processed_rows', models.IntegerField(default=0)),
                ('failed_rows', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('logs', models.TextField(blank=True, default='')),
                ('celery_task_id', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ingestion_jobs', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ingestion_jobs', to='accounts.organization')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

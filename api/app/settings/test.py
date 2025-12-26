from .dev import *

# Use SQLite for tests to avoid PostgreSQL-specific issues
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

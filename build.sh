#!/bin/bash
set -o errexit

# Install all dependencies from requirements.txt
pip install -r requirements.txt

# Apply any database migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

# Build search chunks/embeddings for any post that is new or changed (unchanged posts are skipped)
python manage.py reindex_posts

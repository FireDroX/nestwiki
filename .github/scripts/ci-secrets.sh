#!/bin/sh
# Random secrets for one CI job, exported to its later steps through
# GITHUB_ENV and masked in the logs. Published constants would be known
# to everyone, so the backend would rightly refuse them (KNOWN_DEFAULT_SECRETS).
set -e

for name in DB_PASSWORD MINIO_SECRET_KEY JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  value="$(openssl rand -hex 32)"
  echo "::add-mask::$value"
  echo "$name=$value" >> "$GITHUB_ENV"
done

admin_password="Ci-$(openssl rand -hex 16)-1!"
echo "::add-mask::$admin_password"
echo "ADMIN_PASSWORD=$admin_password" >> "$GITHUB_ENV"

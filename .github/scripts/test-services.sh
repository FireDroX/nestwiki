#!/bin/sh
# MySQL + S3-compatible storage for the backend e2e tests and the image
# smoke test. Started with `docker run -d` rather than as `services:` so
# their images are pulled and booted in the background while the job
# installs dependencies, and because GitHub Actions services can't
# override CMD (needed by RustFS).
#
# RustFS, not Minio: Minio's Community Edition was archived in 2026 and
# is no longer distributed — see docker-compose.yml's `minio` service.
set -e

LOG_DIR="${RUNNER_TEMP:-/tmp}"

case "$1" in
  start)
    nohup docker run -d --name mysql -p 3306:3306 --tmpfs /var/lib/mysql \
      -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" -e MYSQL_DATABASE="$DB_DATABASE" \
      mysql:8 > "$LOG_DIR/mysql-start.log" 2>&1 &
    nohup docker run -d --name minio -p 9000:9000 \
      -e RUSTFS_ACCESS_KEY="$MINIO_ACCESS_KEY" -e RUSTFS_SECRET_KEY="$MINIO_SECRET_KEY" \
      -e RUSTFS_ADDRESS=":9000" -e RUSTFS_CONSOLE_ADDRESS=":9001" \
      rustfs/rustfs:latest /data > "$LOG_DIR/minio-start.log" 2>&1 &
    ;;
  wait)
    for _ in $(seq 1 120); do
      if docker exec mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_PASSWORD" --silent 2> /dev/null \
        && curl -sf http://localhost:9000/health > /dev/null; then
        exit 0
      fi
      sleep 1
    done
    cat "$LOG_DIR/mysql-start.log" "$LOG_DIR/minio-start.log"
    docker logs mysql || true
    docker logs minio || true
    echo "MySQL or object storage did not become healthy in time" >&2
    exit 1
    ;;
  *)
    echo "usage: $0 start|wait" >&2
    exit 2
    ;;
esac

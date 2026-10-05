#!/bin/sh
set -eu

: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

deploy_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$deploy_root"

compose() {
  IMAGE_REPOSITORY="$IMAGE_REPOSITORY" IMAGE_TAG="$IMAGE_TAG" \
    docker compose -f docker-compose.yaml "$@"
}

compose pull web
compose up -d --no-deps web

attempt=0
while [ "$attempt" -lt 18 ]; do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' mock_ai_web 2>/dev/null || true)
  if [ "$status" = "healthy" ]; then
    curl --fail --silent --show-error http://127.0.0.1:8082/ >/dev/null
    docker image prune -f --filter "until=168h" >/dev/null
    printf 'deployed %s:%s\n' "$IMAGE_REPOSITORY" "$IMAGE_TAG"
    exit 0
  fi
  if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
    docker logs --tail 100 mock_ai_web >&2 || true
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 5
done

docker logs --tail 100 mock_ai_web >&2 || true
printf 'deployment timed out waiting for a healthy frontend\n' >&2
exit 1

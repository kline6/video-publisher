#!/bin/bash
# 构建所有服务的 Docker 镜像（本地构建，不推送）
# Build all service Docker images (local build, no push)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Building backend images ==="

cd "$PROJECT_ROOT/project/VideoFlow-backend"

DATE_TAG="$(node -e "console.log(new Date().toISOString().slice(0, 10).replace(/-/g, ''))")"
GIT_HASH="$(git rev-parse --short HEAD)"
IMAGE_TAG="${DATE_TAG}-${GIT_HASH}"

# 构建 VideoFlow-server（不带 -p，不推送到远端）
echo "--- Building VideoFlow-server ---"
node scripts/build-docker.mjs VideoFlow-server

# 构建 VideoFlow-ai
echo "--- Building VideoFlow-ai ---"
node scripts/build-docker.mjs VideoFlow-ai

# 重新 tag 为 docker-compose 期望的名称
echo "--- Tagging images for docker-compose ---"
docker tag "VideoFlow-server:${IMAGE_TAG}" VideoFlow/VideoFlow-server:latest
docker tag "VideoFlow-ai:${IMAGE_TAG}" VideoFlow/VideoFlow-ai:latest

echo "=== Building frontend image ==="

cd "$PROJECT_ROOT/project/VideoFlow-web"
docker build \
  -t VideoFlow/VideoFlow-web:latest .

echo "=== All images built successfully ==="
echo ""
echo "Images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "VideoFlow|REPOSITORY"
echo ""
echo "Run 'docker compose up -d --pull never' to start all services with local images."

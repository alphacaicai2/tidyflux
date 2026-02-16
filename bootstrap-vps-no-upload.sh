#!/usr/bin/env bash
# 在 VPS 上运行（VNC 终端复制粘贴即可）。无需从本机上传文件，脚本会拉代码并部署。
# 使用方法：复制本脚本全文，在 VPS 终端执行: bash -c "$(cat << 'SCRIPT_END'
# 然后粘贴脚本内容，最后一行加上: SCRIPT_END)"

set -e
WORK=/opt/miniflux-tidyflux
mkdir -p "$WORK" && cd "$WORK"

echo "=== 1. 安装 Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker 2>/dev/null || true
fi
if ! docker compose version &>/dev/null; then
  apt-get update -qq && apt-get install -y docker-compose-plugin 2>/dev/null || true
fi
docker compose version || { echo "需要 Docker 与 Docker Compose"; exit 1; }

echo ""
echo "=== 2. 拉取 Tidyflux 源码（你的 fork）==="
if [ ! -d tidyflux-src ]; then
  git clone --depth 1 https://github.com/alphacaicai2/tidyflux.git tidyflux-src
fi

echo ""
echo "=== 3. 写入 Dockerfile.tidyflux ==="
cat > Dockerfile.tidyflux << 'DOCKERFILE'
# 从 alphacaicai2/tidyflux 源码构建（含 AI 翻译等）
FROM node:18-alpine AS builder
RUN apk add --no-cache bash && npm install -g esbuild
WORKDIR /app
COPY tidyflux-src/ .
RUN sed -i 's/\r$//' build.sh && chmod +x build.sh && bash build.sh
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/docker/dist /app
WORKDIR /app/server
RUN npm ci --production
ENV PORT=8812
EXPOSE 8812
CMD ["node", "src/index.js"]
DOCKERFILE

echo "=== 4. 写入 docker-compose.yml ==="
cat > docker-compose.yml << 'COMPOSE'
services:
  miniflux:
    image: miniflux/miniflux:latest
    container_name: miniflux
    ports:
      - "${MINIFLUX_PORT:-8080}:8080"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - RUN_MIGRATIONS=1
      - CREATE_ADMIN=1
      - ADMIN_USERNAME=${MINIFLUX_USERNAME:-admin}
      - ADMIN_PASSWORD=${MINIFLUX_PASSWORD}
      - DATABASE_URL=postgres://miniflux:${POSTGRES_PASSWORD}@db/miniflux?sslmode=disable
      - POLLING_FREQUENCY=${POLLING_FREQUENCY:-60}
    restart: unless-stopped

  db:
    image: postgres:18
    container_name: miniflux-db
    environment:
      - POSTGRES_USER=miniflux
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=miniflux
    volumes:
      - miniflux_db:/var/lib/postgresql
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "miniflux"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  tidyflux:
    build:
      context: .
      dockerfile: Dockerfile.tidyflux
    image: tidyflux:alphacaicai2
    container_name: tidyflux
    ports:
      - "${TIDYFLUX_PORT:-8812}:8812"
    depends_on:
      miniflux:
        condition: service_started
    environment:
      - PORT=8812
      - TZ=${TZ:-Asia/Shanghai}
      - MINIFLUX_URL=http://miniflux:8080
      - MINIFLUX_USERNAME=${MINIFLUX_USERNAME:-admin}
      - MINIFLUX_PASSWORD=${MINIFLUX_PASSWORD}
    volumes:
      - tidyflux_data:/app/server/data
    restart: unless-stopped

volumes:
  miniflux_db:
  tidyflux_data:
COMPOSE

echo "=== 5. 生成 .env 与随机密码 ==="
PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
cat > .env << ENV
MINIFLUX_USERNAME=admin
MINIFLUX_PASSWORD=$PASS
POSTGRES_PASSWORD=$PASS
TZ=Asia/Shanghai
POLLING_FREQUENCY=60
ENV

echo ""
echo "=== 6. 构建并启动（约 2～3 分钟）==="
docker compose up -d --build

echo ""
echo "=== 状态 ==="
docker compose ps

echo ""
echo "========== 部署完成 =========="
echo "  Tidyflux:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8812"
echo "  Miniflux:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"
echo "  账号: admin"
echo "  密码: $PASS"
echo "  请妥善保存密码，或登录后修改。"
echo "=============================="

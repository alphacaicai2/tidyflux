#!/usr/bin/env bash
# 在 VPS 上运行：先上传整个 miniflux-tidyflux 目录到 VPS，再进目录执行 bash deploy-on-vps.sh
# 不要将 root 密码或 SSH 私钥发给任何人或贴到聊天里。

set -e
cd "$(dirname "$0")"

echo "=== 检查 Docker ==="
if ! command -v docker &>/dev/null; then
  echo "未检测到 Docker，正在安装..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
if ! docker compose version &>/dev/null; then
  echo "未检测到 Docker Compose 插件，尝试安装..."
  apt-get update -qq && apt-get install -y docker-compose-plugin 2>/dev/null || true
fi
docker compose version || { echo "请先安装 Docker 与 Docker Compose"; exit 1; }

echo ""
echo "=== 配置 .env ==="
if [ ! -f .env ]; then
  cp .env.example .env
  # 生成随机密码（仅首次）
  PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
  sed -i "s/your_secure_password/$PASS/" .env
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$PASS/" .env
  echo "已生成 .env 并写入随机密码，请记下或登录后修改。"
else
  echo ".env 已存在，跳过。"
fi

echo ""
echo "=== 构建并启动（Tidyflux 首次构建约 1～2 分钟）==="
docker compose up -d --build

echo ""
echo "=== 状态 ==="
docker compose ps

echo ""
echo "完成。"
echo "  Tidyflux:  http://本机IP:8812"
echo "  Miniflux:  http://本机IP:8080"
echo "  账号: admin  密码: 见 .env 中 MINIFLUX_PASSWORD"
echo "若用域名反代，记得在 Tidyflux 设置里填 Miniflux 的域名地址。"

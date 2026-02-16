# VPS 部署清单

## 一、VPS 准备

- 一台有公网 IP 的 Linux（Ubuntu/Debian 等）
- 已装：Docker + Docker Compose
- 若用域名：把域名 A 记录指到 VPS IP

```bash
# 若未装 Docker（Ubuntu/Debian 示例）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 登出再登录后
docker compose version
```

---

## 二、上传项目

把本机整个 **miniflux-tidyflux** 目录拷到 VPS（例如 `/opt/miniflux-tidyflux`）：

- 用 scp、rsync、Git 等随便哪种方式，保证这些都在：
  - `docker-compose.yml`
  - `Dockerfile.tidyflux`
  - `tidyflux-src/`（你 fork 的完整代码）
  - `.env.example`
  - （不要带本机的 `.env`，在 VPS 上新建）

---

## 三、在 VPS 上执行

```bash
cd /opt/miniflux-tidyflux   # 换成你的目录

# 1. 建 .env 并改密码（必做）
cp .env.example .env
nano .env
# 把 MINIFLUX_PASSWORD、POSTGRES_PASSWORD 改成强密码，保存

# 2. 构建并启动（首次构建 Tidyflux 会稍久）
docker compose up -d --build

# 3. 看状态
docker compose ps
```

三个服务都是 `Up` 就说明跑起来了。

---

## 四、访问方式

### 方式 A：直接暴露端口（仅测试或内网）

- 防火墙放行 **8080**（Miniflux）、**8812**（Tidyflux）
- 访问：`http://你的VPS的IP:8812`（Tidyflux）、`http://你的VPS的IP:8080`（Miniflux）

### 方式 B：用 Nginx/Caddy 反代 + HTTPS（推荐）

- 只放行 80、443；8080、8812 可不对外
- 为两个服务各配一个域名（或子域名），例如：
  - `rss.yourdomain.com` → 反代 `http://127.0.0.1:8812`（Tidyflux）
  - `miniflux.yourdomain.com` → 反代 `http://127.0.0.1:8080`（Miniflux）
- 在 Tidyflux 设置里，Miniflux 地址填：`https://miniflux.yourdomain.com`

Caddy 示例（自动 HTTPS）：

```text
rss.yourdomain.com     { reverse_proxy 127.0.0.1:8812 }
miniflux.yourdomain.com { reverse_proxy 127.0.0.1:8080 }
```

---

## 五、常用命令

```bash
cd /opt/miniflux-tidyflux

docker compose logs -f          # 看日志
docker compose restart tidyflux # 只重启前端
docker compose pull && docker compose up -d   # 只更新 Miniflux/Postgres 镜像
# 更新 Tidyflux（你 fork 的代码）
cd tidyflux-src && git pull && cd .. && docker compose build tidyflux && docker compose up -d tidyflux
```

---

## 六、备份（可选）

- 数据库在 volume `miniflux_tidyflux_miniflux_db`，可用 `pg_dump` 或 volume 备份
- Tidyflux 配置在 `miniflux_tidyflux_tidyflux_data`，按需备份

做完「二、上传」和「三、在 VPS 上执行」后，用 8812 或你配的域名打开就能用，AI 翻译/摘要/简报都在。

# Miniflux + Tidyflux 本地与 VPS 部署

- **后端**: [Miniflux v2](https://github.com/miniflux/v2)（RSS 服务，PostgreSQL）
- **前端**: [Tidyflux（你的 fork）](https://github.com/alphacaicai2/tidyflux) 从源码构建，**含 AI 翻译、文章总结、智能简报等增强功能**

## 一、本地测试

### 1. 环境要求

- 已安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)

### 2. 启动

```bash
cd miniflux-tidyflux
docker compose up -d
```

首次会拉取镜像，稍等 1–2 分钟。数据库就绪后 Miniflux 会自动建表并创建管理员。

### 3. 访问

| 服务 | 地址 | 说明 |
|------|------|------|
| **Tidyflux（阅读器）** | http://localhost:8812 | 日常用这个，默认已连本机 Miniflux |
| **Miniflux（管理后台）** | http://localhost:8080 | 订阅源管理、API Key 等 |

本地测试账号（来自 `.env`）：

- 用户名: `admin`
- 密码: `admin123`

在 Tidyflux 页面若提示填 Miniflux 地址，可填：`http://localhost:8080`（或本机 IP:8080），账号密码同上。

### 4. 停止

```bash
docker compose down
```

数据在 Docker volume 里，下次 `up -d` 会保留。

### 5. 更新 Tidyflux（拉取你 fork 的最新代码后重构建）

```bash
cd tidyflux-src
git pull
cd ..
docker compose build tidyflux
docker compose up -d tidyflux
```

---

## 二、VPS 部署

### 1. 上传与准备

- 将本目录（含 `docker-compose.yml`、`.env.example`）上传到 VPS。
- 复制环境变量并改成强密码：

```bash
cp .env.example .env
nano .env   # 或 vim，把 MINIFLUX_PASSWORD、POSTGRES_PASSWORD 改成强密码
```

### 2. 用域名 + HTTPS（推荐）

- 用 Nginx/Caddy 做反向代理，为 Miniflux 和 Tidyflux 配置域名并申请 SSL。
- 在 `.env` 里可增加（示例）：

```bash
# 若通过反向代理暴露，端口可保持 8080/8812，或改为只监听内网
# MINIFLUX_PORT=8080
# TIDYFLUX_PORT=8812
```

- 在 Tidyflux 中填的 Miniflux 地址改为：`https://你的miniflux域名`。

### 3. 启动

```bash
docker compose up -d
docker compose ps   # 确认三个服务都是 running
```

### 4. 防火墙

- 若直接暴露：放行 8080（Miniflux）、8812（Tidyflux）。
- 若用 Nginx/Caddy 反代：只放行 80/443，不必对外开 8080/8812。

### 5. 备份

- 数据库在 volume `miniflux_db`，可用 `pg_dump` 或 volume 备份。
- Tidyflux 配置在 volume `tidyflux_data`，按需备份。

---

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 只重启 Tidyflux
docker compose restart tidyflux

# 完全删除并清空数据（慎用）
docker compose down -v
```

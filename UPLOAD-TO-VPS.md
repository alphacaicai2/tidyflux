# 把项目上传到 VPS 并一键部署

**不要把你的 VPS root 密码或 SSH 私钥发给任何人。**

---

## 步骤 1：在本机打包并上传（在你这台电脑上做）

在 **PowerShell** 里，进入项目上一级目录，用 `scp` 把整个目录拷到 VPS（把 `你的VPS的IP` 换成真实 IP）：

```powershell
cd c:\Users\TonyS\Desktop\ri
scp -r miniflux-tidyflux root@你的VPS的IP:/opt/
```

例如 VPS IP 是 `1.2.3.4`：

```powershell
scp -r miniflux-tidyflux root@1.2.3.4:/opt/
```

提示输入 root 密码时，在 VPS 上设置的 root 密码输入即可（输入不显示，正常）。

若你有 SSH 密钥且已配置好，就不会问密码，直接上传。

---

## 步骤 2：SSH 登录 VPS 并执行部署脚本

用 SSH 登录到 VPS（同样把 IP 换成你的）：

```powershell
ssh root@你的VPS的IP
```

登录成功后，在 VPS 上执行：

```bash
cd /opt/miniflux-tidyflux
# 若本机是 Windows，上传后先去一次换行符再执行（否则可能报 \r 错误）：
sed -i 's/\r$//' deploy-on-vps.sh
bash deploy-on-vps.sh
```

脚本会：检查/安装 Docker、生成 `.env` 和随机密码、构建并启动三个服务。  
结束时会在终端里打印 **Tidyflux** 和 **Miniflux** 的访问地址，以及「密码在 .env 里」的提示。

---

## 步骤 3：记下密码（首次部署时）

脚本首次运行会在 VPS 上生成随机密码并写入 `/opt/miniflux-tidyflux/.env`。  
在 VPS 上查看：

```bash
grep MINIFLUX_PASSWORD /opt/miniflux-tidyflux/.env
```

用这个密码登录 Tidyflux（http://你的VPS的IP:8812）和 Miniflux（:8080），账号都是 `admin`。  
建议登录后在 Miniflux 里改一次密码，并同步更新 `.env` 里的 `MINIFLUX_PASSWORD`（改完后执行 `docker compose up -d` 重启服务）。

---

## 若 8812 / 8080 打不开

在 VPS 上放行端口（示例，按你实际防火墙来）：

```bash
# 若用 ufw
ufw allow 8812
ufw allow 8080
ufw reload
```

云厂商控制台里的「安全组」也要放行 8812、8080（入站）。

---

## 用本机构建的镜像更新 VPS（详细步骤）

适用场景：你在本机改完代码并构建好了 Tidyflux 镜像，希望把**本机这份镜像**部署到 VPS，不在 VPS 上拉源码、不占 VPS 构建时间。

**前提**：VPS 上已经按本文「步骤 1、2」做过**首次部署**，即 `/opt/miniflux-tidyflux` 下存在 `docker-compose.yml`、`.env`，且 Miniflux、数据库、Tidyflux 曾成功跑起来过。

---

### 第一步：本机构建 Tidyflux 镜像

在 **PowerShell** 里执行（路径按你本机实际改）：

```powershell
cd c:\Users\TonyS\Desktop\ri\miniflux-tidyflux
docker compose build tidyflux
```

看到 `tidyflux:alphacaicai2  Built` 即表示构建成功。若你之前改的是 `tidyflux-src` 里的代码，请先确保已保存并在该目录下完成构建。

---

### 第二步：本机导出镜像为文件

仍在同一目录下执行：

```powershell
docker save tidyflux:alphacaicai2 -o tidyflux-image.tar
```

会在当前目录生成 `tidyflux-image.tar`（几百 MB 属正常）。可用 `dir tidyflux-image.tar` 确认文件存在。

---

### 第三步：把镜像文件传到 VPS

把下面命令里的 `你的VPS的IP` 换成你 VPS 的真实 IP（例如 `1.2.3.4`）：

```powershell
scp tidyflux-image.tar root@你的VPS的IP:/opt/miniflux-tidyflux/
```

例如：

```powershell
scp tidyflux-image.tar root@1.2.3.4:/opt/miniflux-tidyflux/
```

提示输入 root 密码时输入 VPS 的 root 密码（输入不显示，正常）。传完后 VPS 上的路径为：`/opt/miniflux-tidyflux/tidyflux-image.tar`。

---

### 第四步：SSH 登录 VPS

```powershell
ssh root@你的VPS的IP
```

登录成功后，后面步骤都在 VPS 上执行。

---

### 第五步：在 VPS 上加载镜像并重启服务

在 VPS 上依次执行：

```bash
cd /opt/miniflux-tidyflux
docker load -i tidyflux-image.tar
docker compose up -d --no-build
```

- `docker load -i tidyflux-image.tar`：把本机导出的镜像加载到 VPS，镜像名为 `tidyflux:alphacaicai2`（若已有同名镜像，标签会指向新镜像，旧镜像变成未使用）。
- `docker compose up -d --no-build`：不重新构建，只用现有镜像启动/更新容器；Tidyflux 会用到刚加载的镜像，Miniflux 和数据库配置不变。

看到 `Container tidyflux  Recreated`、`Container tidyflux  Started` 即表示 Tidyflux 已用新镜像跑起来。

---

### 第六步：验证

1. 浏览器访问：`http://你的VPS的IP:8812`（或你绑定的域名）。
2. 建议按 **Ctrl+Shift+R** 强制刷新，避免缓存旧页面。
3. 登录后确认功能是否为新版本（例如简报分组、时间范围、文末订阅源清单等）。

---

### 可选：清理 VPS 上未使用的旧镜像

更新后，原来的 Tidyflux 镜像会变成「未打标签」的镜像，仍占磁盘。若要清理：

```bash
docker image prune
```

按提示输入 `y` 确认。只删除未被任何容器使用的镜像，不影响当前运行的服务。

---

### 若 VPS 上没有 `/opt/miniflux-tidyflux` 或没有 `.env`

说明尚未做首次部署，请先按本文最前面「步骤 1：在本机打包并上传」和「步骤 2：SSH 登录 VPS 并执行部署脚本」做一遍，再按本节的「用本机构建的镜像更新」操作。

---

### 之后每次更新 Tidyflux

重复上述**第一步～第五步**即可：本机构建 → 导出 tar → scp 到 VPS → SSH 登录 → `docker load` + `docker compose up -d --no-build`。

---

## 其他更新方式（可选）

### 方式二：本机上传源码后在 VPS 上构建

---

### 方式二：本机上传源码后在 VPS 上构建

1. **本机**：确保 `tidyflux-src` 已是最新，再上传整个目录：
   ```powershell
   cd c:\Users\TonyS\Desktop\ri
   scp -r miniflux-tidyflux root@你的VPS的IP:/opt/
   ```
2. **VPS**：只重新构建并启动 Tidyflux：
   ```bash
   cd /opt/miniflux-tidyflux
   docker compose build tidyflux
   docker compose up -d tidyflux
   ```

### 方式三：VPS 上直接拉代码再构建（适合 tidyflux-src 已是 git）

若 VPS 上的 `tidyflux-src` 是 git 仓库（例如 clone 自 GitHub）：

```bash
cd /opt/miniflux-tidyflux/tidyflux-src
git pull origin main
cd /opt/miniflux-tidyflux
docker compose build tidyflux
docker compose up -d tidyflux
```

---

全程都是你在自己电脑和 VPS 上操作，不需要把 root 或密钥交给别人。

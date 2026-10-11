# BITStudy 官方网站

官网：**https://bitstudy.fangwenky.dpdns.org/**  
Android 项目：https://github.com/GaryNasser/Android-Correction-Notebook  
网站源码：https://github.com/Fangwenky/BITStudy-website

学生开发的 BITStudy 项目官网，用于介绍应用、展示最新正式版本，并从 VPS 直接提供 APK 下载。不是北京理工大学校方网站。

## 实现

- 原生 HTML / CSS / JavaScript，无前端构建步骤或第三方运行依赖。
- Nginx 托管官网和安装包，支持断点续传；浏览器只请求本站，不依赖 GitHub API。
- Python 标准库脚本使用 GitHub `/releases/latest` 获取最新正式版，跳过草稿与预发布。
- systemd timer 每 10 分钟检查一次，附加最多 30 秒错峰；无变化时使用 ETag 条件请求。
- 镜像该版本全部 APK；优先选择 universal，其次以 BITStudy 开头的文件作为主下载。
- 校验 APK 文件头、GitHub 标注的文件大小及 SHA-256（如上游提供）。下载完后原子替换文件和版本信息；失败保持现有下载可用，下个周期重试。
- 保留当前版本和最近两个旧版本，控制磁盘占用。网站展示安装包的 SHA-256 和原始发布记录。

## 本地预览和检查

```bash
python3 -m http.server 8080 --directory site
python3 -m unittest discover -s scripts -p 'test_*.py'
node --check site/app.js
```

打开 http://localhost:8080。本地预览没有 `/api/release.json`，会显示版本信息不可用状态；正式服务器提供该接口。

官网围绕北京理工大学（BIT / Beijing Institute of Technology）同学的课表、作业与 DDL、延河课堂、BITShare 展示功能。`site/assets/screenshots/` 中五张图片为 USB 连接的小米 17 Pro Max 上 BITStudy 的原始实机截图（2026-10-11），没有生成或重绘应用内容。截图中的日期、课程、任务和资源列表仅反映截图时的状态，不代表访客的个人数据。

前端采用绿色校园产品风格，支持手机、平板和桌面布局。功能区可切换四类实机界面，点击截图可打开完整原图；弹窗支持滚动、Escape 关闭和焦点恢复。浏览器交互检查可运行 `bash .design/frontend-redesign/verify.sh`（需要已安装 agent-browser）。设计说明与检查记录位于 `.design/frontend-redesign/`。

## 部署到 VPS

服务器：Ubuntu 24.04，已有 Nginx、Python 3、systemd。域名通过 Cloudflare 代理指向 VPS，源站 TLS 使用服务器现有的 Cloudflare Origin 通配证书（`*.fangwenky.dpdns.org`），公网访问使用 Cloudflare 的 HTTPS 证书。证书私钥不进入仓库。

```bash
bash deploy/deploy.sh
# 或指定目标服务器（需要自行调整域名和证书配置）
bash deploy/deploy.sh root@107.175.115.136
```

部署只新增本站目录、Nginx 虚拟主机和同步服务，不覆盖其他站点配置。需已有 SSH 登录权限和 root 权限；传输采用 tar + SSH，不需要 rsync。更新官网时重新执行该脚本。

| 路径 | 用途 |
| --- | --- |
| `/opt/bitstudy-website` | 网站源文件与同步脚本 |
| `/var/www/bitstudy` | Nginx 静态站点目录 |
| `/var/lib/bitstudy/downloads` | APK 文件，专用 bitstudy 用户管理 |
| `/var/lib/bitstudy/release.json` | 对外版本元数据 |
| `/var/lib/bitstudy/state.json` | 内部 ETag 状态，不公开 |
| `/etc/nginx/sites-available/bitstudy` | 本站 Nginx 配置 |
| `/etc/systemd/system/bitstudy-release-sync.*` | 定期检查服务与计时器 |

`/api/release.json` 提供版本信息，`/download/latest.apk` 始终提供最近一次成功镜像的主 APK；页面按钮使用 `/downloads/<release-id>/<asset-id>-<filename>.apk`，确保展示的版本与下载文件对应。最新链接和元数据设置 `Cache-Control: no-store`，版本文件缓存一天。移除旧版本后其链接可能返回 404，请优先分享官网或最新链接。

### Android 应用更新检查

Android 应用复用 `GET https://bitstudy.fangwenky.dpdns.org/api/release.json`，无需新增接口或部署配置：

| 字段 | 应用用途 |
| --- | --- |
| `tag` | 最新正式版本名称，例如 `v1.0.5`；按数字版本比较，与本机的 `1.0.5` 视为同版 |
| `notes` | 更新弹窗中的发布说明 |
| `published_at` | ISO 8601 发布时间 |

接口不提供 Android `versionCode`，因此正式版本必须递增版本名称；应用不从 GitHub ID 或 tag 推算版本码，也不启用强制更新。缺失或无效的 `tag` 会被应用视为检查失败。`download_url` 是网页使用的 APK 路径，应用点击「前往官网下载」固定打开 `https://bitstudy.fangwenky.dpdns.org/#download`，由用户在官网选择下载安装包。

继续在 Android 仓库发布带 APK 的正式 GitHub Release 即可；本站 timer 通常约 10 分钟内完成镜像。只有下载和校验成功后才发布新元数据，避免应用提示更新时官网还没有对应安装包。

## 运维

```bash
# 手动检查新版本
ssh root@107.175.115.136 'systemctl start bitstudy-release-sync.service'
# 查看最近同步日志
ssh root@107.175.115.136 'journalctl -u bitstudy-release-sync.service -n 50 --no-pager'
# 查看下一次检查时间
ssh root@107.175.115.136 'systemctl list-timers bitstudy-release-sync.timer --no-pager'
```

默认使用公开 GitHub API，无需 token。若共享出口遇到速率限制，可在服务器 `/etc/bitstudy.env` 设置 `GITHUB_TOKEN=...` 并设为 `600` 权限；服务会自动读取。不要将 token 提交到 GitHub。没有 APK 的新版本或下载失败不会更新 ETag，也不会撤掉上一个可用版本。

服务以专用非登录用户执行，写权限限定在镜像目录。下载单文件大小上限为 1 GiB。SHA-256 校验保证下载完整性，不替代 Android 安装时的签名验证。

应用图标来自原 Android 项目（GaryNasser）；功能介绍依据项目 README 和发布说明。网站源码使用 MIT License。

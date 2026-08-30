# OSSDrive 维护规则

本仓库是 OSSDrive 的 Go 简版，生产代码位于仓库根目录。后续维护优先在本仓库进行，不要把功能迁移到 `ossdrive-dufs`，除非维护者明确要求。

## 架构

- `main.go` 创建阿里云 OSS 客户端并启动 HTTP 服务。
- `handlers.go` 提供目录列表、上传签名、下载地址、删除和创建目录接口。
- `page.html` 是主页面样式和 HTML 外壳。
- `app.js` 是前端交互逻辑。
- 上传文件内容由浏览器直接 `PUT` 到 OSS，不经过 ECS 文件流量。
- 下载默认使用配置的公开 OSS 地址；如果修改为签名下载，必须确认不会把文件内容转发经过 ECS。
- `OSS_PREFIX` 是虚拟根目录，所有用户路径都必须经过 `app.key()` 校验，禁止路径穿越和 NUL 字节。

## 部署规则

### 测试环境

向 `main` 分支推送代码会触发 `.github/workflows/deploy.yml`：

1. GitHub Actions 使用 Go 构建 Linux amd64 静态二进制。
2. 自动更新 ECS 上的 `ossdrive-test` 容器。
3. 测试端口是 `5001`。
4. 测试环境使用独立的 `OSS_PREFIX`，不得误改生产容器。

### 生产环境

只有推送 `v*` 标签才部署生产：

```bash
git tag v2026.08.30
git push origin v2026.08.30
```

生产端口是 `5000`，生产部署使用 `ossdrive` 容器。普通推送到 `main` 不得更新生产环境。

也可以在 GitHub Actions 页面手动运行 Workflow，并明确选择 `test` 或 `production`。

## 密钥规范

- 不要把 GitHub Token、服务器密码、OSS AK/SK 写入源码、README、Issue、日志或提交信息。
- 部署凭据只放在 GitHub Actions Secrets：`SSH_HOST`、`SSH_USER`、`SSH_PASSWORD`。
- OSS 凭据由服务器现有容器环境变量提供，Workflow 不应硬编码或打印这些值。
- 任何疑似泄露的 Token、密码或 AK/SK 必须立即更换，不要继续使用。

## 前端交互约定

- 文件列表行需要保留悬停高亮。
- 文件行空白区域和“下载”按钮都应触发下载。
- 删除按钮只能删除，不能触发行下载。
- 文件名放入 HTML 属性或 URL 前必须正确转义/编码，优先使用 `encodeURIComponent`，不要手拼未编码路径。
- 网络、上传、下载、删除和目录加载失败必须在页面上显示可读错误，不能要求用户打开开发者工具。
- 错误提示默认不自动消失；需要提供明确的手动关闭操作。

## 修改和验证

- 修改前先检查 `git status`、当前分支和远端最新代码，避免覆盖其他维护者的提交。
- 不要提交冲突标记（`<<<<<<<`、`=======`、`>>>>>>>`）。
- 前端修改后至少运行 `node --check app.js`。
- Go 环境可用时运行 `go test ./...`，并用 `go vet ./...` 检查明显问题。
- 修改部署 Workflow 后，必须检查对应 GitHub Actions Run 的最终结果，不要只看构建是否开始。
- 部署后至少检查：`/health`、页面 `/`、目录列表、上传、下载和删除。
- 不要在未验证的情况下声称已部署成功。

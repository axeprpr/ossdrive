# OSSDrive

一个极简的免注册 OSS 网盘：文件列表由 Go 服务读取，上传和下载使用浏览器直连阿里云 OSS 的签名 URL，文件数据不经过应用服务器。应用服务器只负责列举对象、生成临时签名地址和执行管理操作。

## 功能

- 匿名打开即用
- 拖拽或点击选择文件上传
- 上传进度、百分比和实时速度显示
- 文件下载和删除
- 目录浏览
- 每 10 秒自动刷新
- 按客户端 IP 限制上传地址请求频率
- 在当前目录创建子目录
- 上传、下载失败时在页面内显示可关闭的错误提示
- 下载文件名通过事件委托处理，避免特殊字符破坏前端脚本

## Agent 技能说明

给其他 Agent 使用的操作说明位于当前部署的：

`/skills.md`

访问 `/skills.md` 时，服务会根据当前请求的协议和 Host 动态生成 API 根地址，不会把某个私有部署域名写死在源码中。文档面向 Agent，包含列目录、获取上传/下载签名地址、上传、下载、删除和创建目录的 HTTP/curl 示例；它不包含账号、密码或 OSS 密钥。

## 文件操作 API

```text
GET  /api/list?prefix=<目录>
POST /api/upload-url       {"name":"文件名"}
GET  /api/download-url?name=<文件名>
POST /api/delete           {"name":"文件名"}
POST /api/mkdir            {"name":"目录名"}
```

上传和下载都使用有效期 15 分钟的 OSS 签名 URL。客户端先请求 `/api/upload-url` 或 `/api/download-url`，再直接向返回的 OSS URL 执行 `PUT` 或 `GET`。文件数据不会经过应用服务器。

## 配置

通过环境变量配置 OSS，不要把密钥写入源码或提交到 Git：

```bash
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=your-bucket
OSS_REGION=cn-hangzhou
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_PREFIX=drive
PORT=3000
```

推荐使用私有 Bucket，并为运行服务的 RAM 用户授予最小权限：

```text
oss:ListObjects
oss:GetObject
oss:PutObject
oss:DeleteObject
```

对象权限资源应覆盖配置的 Bucket 和对象前缀，例如：

```text
acs:oss:*:*:your-bucket/*
```

私有 Bucket 不会暴露 AccessKey Secret。Secret 只存在服务端环境变量中，客户端只能获得针对单个对象、单个操作且有时效限制的签名 URL。OSS Bucket 还需要配置 CORS，允许网盘页面来源执行 `PUT`、`GET` 和 `HEAD`。

应用启动时不会自动修改 Bucket ACL；Bucket 的 `private`、`public-read` 或 `public-read-write` 应在 OSS 控制台或独立的基础设施配置中管理。

## Docker

```bash
docker build -t ossdrive .
docker run -d --name ossdrive -p 5000:3000 \
  -e OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com \
  -e OSS_BUCKET=your-bucket \
  -e OSS_REGION=cn-hangzhou \
  -e OSS_ACCESS_KEY_ID=your-access-key-id \
  -e OSS_ACCESS_KEY_SECRET=your-access-key-secret \
  ossdrive
```

## 构建二进制

GitHub Actions 支持手动运行，也会在推送 `v*` 标签时自动构建：

- Linux：`amd64`、`arm64`
- macOS：`amd64`、`arm64`
- Windows：`amd64`、`arm64`

手动运行时可在 GitHub Actions 页面下载 Artifacts。发布版本时执行：

```bash
git tag v1.0.0
git push origin v1.0.0
```

随后构建产物会自动作为 GitHub Release 附件发布。

应用服务器需要具备 OSS 的列举对象、读取对象、写入对象和删除对象权限。公开部署前，建议使用专用 RAM 用户和单独 Bucket，并按需收紧删除权限。

## 注意

当前实现允许同名文件覆盖，也允许匿名删除；上传地址请求限制为同一 IP 每分钟最多 10 次。删除接口没有额外的应用层认证，公开部署时应在反向代理、网络访问控制或应用层补充鉴权。单文件大小和总容量限制应通过 OSS 策略、RAM 权限或额外的服务端校验配置。

前端会处理网络失败、非 `2xx` 响应、无效 JSON、上传超时、上传中止和 OSS 错误，并在页面内显示错误；列表加载失败时提供重试按钮。

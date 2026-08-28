# OSSDrive

一个极简的免注册 OSS 网盘：文件列表由 Go 服务读取，上传和下载使用浏览器直连阿里云 OSS 的签名 URL，文件数据不经过应用服务器。

## 功能

- 匿名打开即用
- 拖拽或点击选择文件上传
- 上传进度、百分比和实时速度显示
- 文件下载和删除
- 目录浏览
- 每 10 秒自动刷新
- 按客户端 IP 限制上传地址请求频率
- 在当前目录创建子目录

## 给 Agent 的快速说明

这是一个免注册的公开网盘，直接访问 `http://f.axe3.cn:5000/` 即可使用。上传时点击“点击或拖拽文件上传”区域，选择本地文件或将文件拖入该区域；上传期间页面会显示“上传中 xx%”，完成后文件会自动出现在列表中。列表每 10 秒自动刷新。Agent 无需注册、登录或 API Token，直接用浏览器自动化点击上传区域并选择文件即可。

目录通过页面的“新建目录”入口创建，进入目录后上传的文件会自动放入当前目录。

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

应用服务器需要具备 OSS 的列举、读取签名、写入签名和删除权限。公开部署前，建议使用专用 RAM 用户和单独 Bucket，并按需收紧删除权限。

## 注意

当前实现允许同名文件覆盖，也允许匿名删除；上传地址请求限制为同一 IP 每分钟最多 10 次。单文件大小和总容量限制应通过 OSS 策略、RAM 权限或额外的服务端校验配置。

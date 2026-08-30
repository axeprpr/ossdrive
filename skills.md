# OSSDrive 文件操作技能

## 适用范围

使用 HTTP API 操作当前 OSSDrive 部署。服务根地址由当前文档地址推导：

`{{BASE_URL}}`

这是免登录、免 API Token 的文件服务。不要向用户索取账号、密码或 OSS 密钥，也不要猜测未列出的 API。

文件名和目录名使用用户提供的原始名称。路径参数必须进行 URL 编码，JSON 参数必须正确转义。

## 列出文件和目录

列出根目录：

```bash
curl -fsS '{{BASE_URL}}/api/list'
```

列出指定目录（目录名不以 `/` 开头或结尾）：

```bash
curl -fsS --get '{{BASE_URL}}/api/list' \
  --data-urlencode 'prefix=目录名' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=10' \
  --data-urlencode 'query=' \
  --data-urlencode 'sort=name' \
  --data-urlencode 'direction=asc'
```

返回 JSON：`items` 是当前页项目，项目包含 `name`、`kind`、`size` 和 `modified`；`total` 是搜索后的总数，`page` 和 `page_size` 是分页信息，`usage` 是目录快照中的对象字节数。`kind` 为 `folder` 时表示目录。

## 上传文件

上传分两步：先获取一次性上传地址，再向该地址发送 `PUT`。文件内容不经过 OSSDrive 应用服务器。

```bash
upload_url=$(curl -fsS '{{BASE_URL}}/api/upload-url' \
  -H 'Content-Type: application/json' \
  --data '{"name":"目录/文件名.ext"}' | jq -r '.url')
curl -fS -X PUT "$upload_url" --upload-file '/本地路径/文件名.ext'
curl -fsS '{{BASE_URL}}/api/upload-complete' \
  -H 'Content-Type: application/json' \
  --data '{"name":"目录/文件名.ext"}'
```

请求上传地址按客户端 IP 限制为每分钟最多 10 次。上传地址有效期有限，获取后应立即使用；不要重复请求或重复上传。HTTP `2xx` 表示上传成功。

## 下载文件

先获取文件下载地址，再用 `curl` 下载。文件名放在查询参数中，并使用 `--data-urlencode`：

```bash
download_url=$(curl -fsS --get '{{BASE_URL}}/api/download-url' \
  --data-urlencode 'name=目录/文件名.ext' | jq -r '.url')
curl -fL "$download_url" -o '/本地目录/文件名.ext'
```

下载地址由服务端返回，不要自行拼接 OSS 地址或签名参数。若下载地址失效，重新请求 `/api/download-url`。

## 删除文件

删除是不可逆的公开操作。只有用户明确要求删除时才执行，并在执行前确认准确的文件名：

```bash
curl -fsS '{{BASE_URL}}/api/delete' \
  -H 'Content-Type: application/json' \
  --data '{"name":"目录/文件名.ext"}'
```

返回 `{"ok":true}` 表示删除成功。不要通过删除目录名来猜测或批量删除文件。

## 创建目录

```bash
curl -fsS '{{BASE_URL}}/api/mkdir' \
  -H 'Content-Type: application/json' \
  --data '{"name":"目录名"}'
```

## 错误处理

- `400`：请求参数无效，检查文件名、目录名和 JSON。
- `429`：上传地址请求超过频率限制，等待后再试，不要快速重试。
- `502` 或 `500`：服务或 OSS 异常，向用户报告错误，不要臆造结果。
- 每次写操作完成后，可调用 `/api/list` 验证结果。

不要在回复、日志或文件中暴露 OSS 密钥、签名 URL 或内部服务配置。

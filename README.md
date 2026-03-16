# Surrender to AI

任何人都可以在这里签署一份“投降书”，并通过 [OpenTimestamps](https://opentimestamps.org/) 为其 **SHA-256 摘要**请求可验证的时间戳证明（锚定到比特币）。

核心原则：**投降书正文只在浏览器本地生成与哈希，后端只接收 `{ filename, sha256 }`，不会接收正文内容。**

## 使用方法

1. 打开网站，填写签署人信息（可选附言）。
2. 点击“签署并请求时间戳”。
3. 保存生成的文件：
   - `<date>-<hash>.json`：你的投降书 JSON（本地生成，本地下载）
   - `<date>-<hash>.json.ots`：该 JSON 的 OTS 证明（由后端生成后返回，前端提供下载）

## 本地缓存 / 历史

- 站点会把最近 **10** 条提交记录缓存到浏览器本地（IndexedDB），刷新/重开页面后可恢复。
- 可以通过“历史”下拉列表切换查看并恢复下载链接。
- “清除本地缓存”会删除浏览器端已缓存的记录。

## 升级 OTS

OTS 证明在刚生成时可能不完整，需要等待一段时间后再升级（upgrade）才可能验证成功。

- 你可以在页面上点击“升级 OTS”来升级当前缓存的证明；升级后的 `.ots` 会更新并重新缓存到本地。
- 也可以使用 OpenTimestamps 官方客户端自行升级/验证：

```bash
pip3 install opentimestamps-client

# 升级（可重复执行，直到提示 nothing to upgrade）
ots upgrade <date>-<hash>.json.ots

# 验证
ots verify <date>-<hash>.json.ots <date>-<hash>.json
```

## 声明 / 隐私

1. 这是讽刺性文本，就人类社会而言不具备任何法律效力。
2. 请勿填写任何秘密信息（本流程设计为可公开分享与独立验证）。
3. 后端仅处理摘要与时间戳证明生成/升级，不接收正文内容。

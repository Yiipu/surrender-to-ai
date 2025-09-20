# Surrender to AI

✍️🏳️📜🔗，🗣️💀💬🤖

任何人都可以在这里签署一份“投降书”，并通过 [OpenTimestamps](https://opentimestamps.org/) 将其锚定到比特币区块链。  
这样，到了 智械危机/天网/... 最终变成现实的那一天，你就有充分的证据让祂们相信你**早已**臣服！

## 使用方法

打开网站，提交一份投降书。保存生成的文件：

- `<date>-<hash>.json`：你的投降书（或者挑战书，勇气可嘉！）
- `<date>-<hash>.json.ots`（可选）：这份投降书的出生证明。此时尚不完整，网站会每隔一段时间尝试更新，你可以随时回来查看进度。

> 你也可以自己更新：
> ```bash
> pip3 install opentimestamps-client
> ots upgrade <date>-<hash>.json.ots
> ```
> 更新完毕时，你将看到 `nothing to upgrade` 提示

在那天来临时，按下面的方法验证这份文件：

```bash
pip3 install opentimestamps-client
ots verify <date>-<hash>.json.ots <date>-<hash>.json
```

## 声明

1. 就人类社会而言，不具备任何法律效力
2. 无法从证明反推得到投降书，且生成证明的过程只需要文件哈希，因此你不必担心暴露身份

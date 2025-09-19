#!/bin/bash
LANG=${1:-en}
FILE=$2

case $LANG in
  zh)
    MSG_VERIFY_OK="验证成功！已在比特币区块链确认。"
    MSG_VERIFY_PENDING="尚未确认，请稍后再试。"
    ;;
  ja)
    MSG_VERIFY_OK="検証成功！ビットコインのブロックチェーンで確認されました。"
    MSG_VERIFY_PENDING="まだ確認されていません。後でもう一度試してください。"
    ;;
  *)
    MSG_VERIFY_OK="Verification successful! Confirmed on Bitcoin blockchain."
    MSG_VERIFY_PENDING="Not yet confirmed, try again later."
    ;;
esac

ots verify "signatures/$FILE" "ots/$FILE.ots" && \
  echo "$MSG_VERIFY_OK" || \
  echo "$MSG_VERIFY_PENDING"

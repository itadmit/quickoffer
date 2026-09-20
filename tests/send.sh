#!/bin/bash
# usage: tests/send.sh <msgId> <type text|aud|image> <text-or-mediaUrl> [token]
ID=$1; TYPE=$2; BODY=$3; TOKEN=${4:-hook-secret}
if [ "$TYPE" = "text" ]; then CTX="{\"text\":$(printf '%s' "$BODY" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),\"mediaUrl\":null}";
else CTX="{\"caption\":\"\",\"fileName\":\"x.oga\",\"mimetype\":\"audio/ogg; codecs=opus\",\"mediaUrl\":\"$BODY\"}"; fi
curl -s -o /dev/stdout -w " [%{http_code} %{time_total}s]\n" -X POST localhost:3000/api/webhooks/ibot \
  -H "content-type: application/json" -H "X-Webhook-Token: $TOKEN" \
  -d "{\"uid\":\"u\",\"sessionId\":\"s\",\"instanceId\":\"i\",\"chatId\":\"c\",\"remoteJid\":\"972542284283@s.whatsapp.net\",\"msgFromMe\":false,\"actualObj\":{\"group\":false,\"type\":\"$TYPE\",\"msgId\":\"$ID\",\"remoteJid\":\"972542284283@s.whatsapp.net\",\"msgContext\":$CTX,\"reaction\":\"\",\"status\":\"sent\",\"star\":false,\"timestamp\":$(date +%s),\"senderName\":\"יוגב אביטן תדמית אינטראקטיב\",\"route\":\"incoming\",\"context\":null}}"

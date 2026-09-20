import json, urllib.request
for m in json.load(urllib.request.urlopen("http://localhost:4001/__sent")):
    print(f"\n[{m['kind']}] → {m['jid']}\n{m['msg']}")

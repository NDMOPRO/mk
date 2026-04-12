"""
FAST TARGETED CLEANUP
Only scans known ranges where messages exist (340-950).
Uses 3-second timeout instead of 15.
"""
import urllib.request, json, time, re

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
BOT_ID = 8729034252

PINNED_IDS = {384, 386, 388, 390, 392, 394, 396, 398, 400, 402, 404, 406, 408, 410, 412, 414}
KEEP_KEYWORDS = ["CEO TASK ASSIGNMENT", "MKT-2026-001", "Field Report Received", "Manager Priorities Logged"]

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "description": str(e)}

deleted = 0
kept = 0
users = 0
log_lines = []

def log(msg):
    log_lines.append(msg)
    with open("/tmp/fast-cleanup.log", "a") as f:
        f.write(msg + "\n")

log("=== FAST CLEANUP START ===")

# Scan ranges where we know messages exist: 340-950
for msg_id in range(340, 950):
    r = api("forwardMessage", {
        "chat_id": CHAT_ID, "from_chat_id": CHAT_ID,
        "message_id": msg_id, "disable_notification": True
    })
    
    desc = r.get("description", "")
    if "Too Many Requests" in desc:
        m = re.search(r"retry after (\d+)", desc)
        wait = int(m.group(1)) + 2 if m else 10
        log(f"  RATE {msg_id} wait {wait}s")
        time.sleep(wait)
        r = api("forwardMessage", {
            "chat_id": CHAT_ID, "from_chat_id": CHAT_ID,
            "message_id": msg_id, "disable_notification": True
        })
    
    if not r.get("ok"):
        desc = r.get("description", "")
        if "can't be forwarded" in desc.lower():
            dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
            if dr.get("ok"):
                log(f"  SVC-DEL {msg_id}")
                deleted += 1
        continue
    
    fmsg = r["result"]
    fwd_id = fmsg["message_id"]
    text = (fmsg.get("text") or fmsg.get("caption") or "")[:200]
    
    ff = fmsg.get("forward_from") or {}
    fo = (fmsg.get("forward_origin") or {}).get("sender_user") or {}
    sender_id = ff.get("id") or fo.get("id")
    
    api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
    
    if sender_id != BOT_ID:
        users += 1
        time.sleep(0.03)
        continue
    
    keep = msg_id in PINNED_IDS or any(kw in text for kw in KEEP_KEYWORDS)
    
    if keep:
        log(f"  KEEP {msg_id}: {text[:60]}")
        kept += 1
    else:
        dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        if "Too Many Requests" in dr.get("description", ""):
            m = re.search(r"retry after (\d+)", dr.get("description", ""))
            time.sleep(int(m.group(1)) + 2 if m else 10)
            dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        if dr.get("ok"):
            log(f"  DEL {msg_id}: {text[:60]}")
            deleted += 1
        else:
            log(f"  FAIL {msg_id}: {dr.get('description','')[:40]}")
    
    time.sleep(0.08)
    
    if msg_id % 50 == 0:
        log(f"--- {msg_id}/950 | del:{deleted} kept:{kept} users:{users} ---")

summary = f"\n=== DONE: deleted={deleted} kept={kept} users={users} ==="
log(summary)
print(summary)

# Print all log lines at the end
for line in log_lines:
    print(line)

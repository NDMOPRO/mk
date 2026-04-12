"""
TOTAL CLEANUP v2 — Simpler, more reliable
Scans IDs 1-1000, deletes all bot messages except pinned ones.
Writes results directly to file.
"""
import urllib.request, json, time, re, sys

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
BOT_ID = 8729034252

# Pinned message IDs to KEEP
PINNED_IDS = {384, 386, 388, 390, 392, 394, 396, 398, 400, 402, 404, 406, 408, 410, 412, 414}

KEEP_KEYWORDS = ["CEO TASK ASSIGNMENT", "MKT-2026-001", "Field Report Received", "Manager Priorities Logged"]

LOG = open("/tmp/cleanup-v2.log", "w")

def log(msg):
    LOG.write(msg + "\n")
    LOG.flush()
    print(msg, flush=True)

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "description": str(e)}

deleted = 0
kept = 0
users = 0

log("=== TOTAL CLEANUP v2 START ===")

for msg_id in range(1, 1001):
    # Forward to identify
    r = api("forwardMessage", {
        "chat_id": CHAT_ID,
        "from_chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })
    
    # Handle rate limit
    desc = r.get("description", "")
    if "Too Many Requests" in desc:
        m = re.search(r"retry after (\d+)", desc)
        wait = int(m.group(1)) + 2 if m else 10
        log(f"  Rate limited at {msg_id}, waiting {wait}s")
        time.sleep(wait)
        r = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
    
    if not r.get("ok"):
        desc = r.get("description", "")
        if "can't be forwarded" in desc.lower():
            # Service message — delete it
            api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
            log(f"  SVC DEL {msg_id}")
            deleted += 1
        continue
    
    fmsg = r["result"]
    fwd_id = fmsg["message_id"]
    text = (fmsg.get("text") or fmsg.get("caption") or "")[:200]
    
    # Get sender
    sender_id = None
    ff = fmsg.get("forward_from") or {}
    fo = (fmsg.get("forward_origin") or {}).get("sender_user") or {}
    sender_id = ff.get("id") or fo.get("id")
    
    # Delete forwarded copy
    api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
    
    if sender_id != BOT_ID:
        users += 1
        time.sleep(0.05)
        continue
    
    # Bot message — check if we should keep it
    keep = msg_id in PINNED_IDS or any(kw in text for kw in KEEP_KEYWORDS)
    
    if keep:
        log(f"  KEEP {msg_id}: {text[:50]}")
        kept += 1
    else:
        dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        if "Too Many Requests" in dr.get("description", ""):
            m = re.search(r"retry after (\d+)", dr.get("description", ""))
            time.sleep(int(m.group(1)) + 2 if m else 10)
            dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        
        if dr.get("ok"):
            log(f"  DEL {msg_id}: {text[:50]}")
            deleted += 1
        else:
            log(f"  FAIL {msg_id}: {dr.get('description','')}")
    
    time.sleep(0.1)
    
    if msg_id % 100 == 0:
        log(f"--- {msg_id}/1000 | del:{deleted} kept:{kept} users:{users} ---")

log(f"\n=== DONE: deleted={deleted} kept={kept} users={users} ===")
LOG.close()

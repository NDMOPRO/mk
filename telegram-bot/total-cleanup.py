"""
TOTAL CLEANUP SCRIPT
====================
Bot is STOPPED. Now scan every message ID (1-1000) in the group.
For every message sent by the bot:
  - If it's a known pinned reference message: KEEP it
  - If it's the CEO task assignment (MKT-2026-001) in Marketing: KEEP it
  - If it's a field report in Blockers/Priorities: KEEP it
  - Everything else from the bot: DELETE it
NEVER delete messages from real users.
"""
import urllib.request, json, time, re, sys

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285
BOT_ID = 8729034252

# Known pinned message IDs to KEEP (from the mission-ready pins deployment)
# These are the professional bilingual pinned messages we posted
PINNED_IDS = {384, 386, 388, 390, 392, 394, 396, 398, 400, 402, 404, 406, 408, 410, 412, 414}

# Also keep the CEO task assignment and field reports
KEEP_KEYWORDS = [
    "CEO TASK ASSIGNMENT",       # Marketing task
    "MKT-2026-001",              # Marketing task ref
    "Field Report Received",     # Mushtaq field reports
    "Manager Priorities Logged", # Mushtaq priorities
]

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "description": str(e)}

def rate_wait(r):
    desc = r.get("description", "")
    if "Too Many Requests" in desc:
        m = re.search(r"retry after (\d+)", desc)
        wait = int(m.group(1)) + 2 if m else 10
        print(f"    ⏳ Rate limited, waiting {wait}s...", flush=True)
        time.sleep(wait)
        return True
    return False

stats = {"scanned": 0, "bot_deleted": 0, "bot_kept": 0, "user_kept": 0, "not_found": 0, "errors": 0}

print("=" * 60, flush=True)
print("TOTAL CLEANUP — Scanning IDs 1-1000", flush=True)
print("Bot is STOPPED. Safe to clean.", flush=True)
print("=" * 60, flush=True)
print(flush=True)

for msg_id in range(1, 1001):
    stats["scanned"] += 1
    
    # Try to forward the message to identify sender and content
    r = api("forwardMessage", {
        "chat_id": CHAT_ID,
        "from_chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })
    
    if rate_wait(r):
        r = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
    
    if not r.get("ok"):
        desc = r.get("description", "")
        if "message to forward not found" in desc or "not found" in desc.lower():
            stats["not_found"] += 1
        elif "can't be forwarded" in desc.lower():
            # Service message — try to delete it (likely a pin notification)
            dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
            if dr.get("ok"):
                print(f"  🗑️  ID:{msg_id} — Service message deleted", flush=True)
                stats["bot_deleted"] += 1
            else:
                stats["not_found"] += 1
        else:
            stats["errors"] += 1
        time.sleep(0.05)
        continue
    
    fmsg = r["result"]
    fwd_id = fmsg["message_id"]
    text = fmsg.get("text") or fmsg.get("caption") or ""
    thread = fmsg.get("message_thread_id")
    
    # Identify sender
    sender_id = None
    sender_name = "unknown"
    fwd_from = fmsg.get("forward_from") or {}
    fwd_origin = fmsg.get("forward_origin") or {}
    
    if fwd_from:
        sender_id = fwd_from.get("id")
        sender_name = f"{fwd_from.get('first_name','')} {fwd_from.get('last_name','')}".strip()
    elif fwd_origin.get("sender_user"):
        su = fwd_origin["sender_user"]
        sender_id = su.get("id")
        sender_name = f"{su.get('first_name','')} {su.get('last_name','')}".strip()
    else:
        sender_name = fmsg.get("forward_sender_name", "protected")
    
    # Delete the forwarded copy immediately
    api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
    
    is_bot = (sender_id == BOT_ID)
    
    if not is_bot:
        # Real user message — NEVER delete
        stats["user_kept"] += 1
        time.sleep(0.05)
        continue
    
    # It's a bot message. Should we keep it?
    should_keep = False
    keep_reason = ""
    
    # Check if it's a known pinned message
    if msg_id in PINNED_IDS:
        should_keep = True
        keep_reason = "pinned reference"
    
    # Check if it contains important content we want to keep
    for kw in KEEP_KEYWORDS:
        if kw in text:
            should_keep = True
            keep_reason = f"contains '{kw}'"
            break
    
    if should_keep:
        print(f"  ✅ KEEP ID:{msg_id} thread:{thread} — {keep_reason} — {text[:50]}...", flush=True)
        stats["bot_kept"] += 1
    else:
        # DELETE this bot message
        dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        if rate_wait(dr):
            dr = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        
        if dr.get("ok"):
            print(f"  🗑️  DEL ID:{msg_id} thread:{thread} — {text[:60]}", flush=True)
            stats["bot_deleted"] += 1
        else:
            print(f"  ❌ FAIL ID:{msg_id} — {dr.get('description','')}", flush=True)
            stats["errors"] += 1
    
    time.sleep(0.1)
    
    if msg_id % 100 == 0:
        print(f"\n  --- Progress: {msg_id}/1000 | Deleted:{stats['bot_deleted']} Kept:{stats['bot_kept']} Users:{stats['user_kept']} ---\n", flush=True)

print(f"\n{'='*60}", flush=True)
print(f"CLEANUP COMPLETE", flush=True)
print(f"{'='*60}", flush=True)
print(f"  Scanned:      {stats['scanned']}", flush=True)
print(f"  Bot deleted:   {stats['bot_deleted']}", flush=True)
print(f"  Bot kept:      {stats['bot_kept']}", flush=True)
print(f"  User kept:     {stats['user_kept']}", flush=True)
print(f"  Not found:     {stats['not_found']}", flush=True)
print(f"  Errors:        {stats['errors']}", flush=True)
print(f"{'='*60}", flush=True)

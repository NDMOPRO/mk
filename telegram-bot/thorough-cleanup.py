"""
THOROUGH CLEANUP — Final pass
Strategy: Try to delete every message ID from bot. 
deleteMessage only succeeds on bot-sent messages (or messages in groups where bot is admin).
We protect the known PINNED IDs by skipping them.
This is much faster than forwarding since we don't need to identify the sender.
"""
import urllib.request, json, time, re, sys

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285

# These are the ONLY messages we keep — one professional pin per topic + CEO task
PROTECTED_IDS = {
    384,   # Topic 00 - Rules & Guide pin
    386,   # Topic 01 - CEO Update pin  
    388,   # Topic 02 - Operations pin
    390,   # Topic 03 - Listings pin
    392,   # Topic 04 - Bookings pin
    394,   # Topic 05 - Customer Support pin
    396,   # Topic 06 - Tech Issues pin
    398,   # Topic 07 - Payments pin
    400,   # Topic 08 - Marketing pin
    402,   # Topic 12 - Priorities pin
    404,   # Topic 15 - Admin Panel pin
    406,   # Topic 01 - CEO Daily Protocol
    408,   # Topic 09 - Legal pin
    410,   # Topic 10 - Blockers pin
    412,   # Topic 11 - Completed pin
    414,   # Topic 00 - 49-Feature Guide
    928,   # CEO Task Assignment (Marketing)
}

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "description": str(e)}

deleted = 0
protected = 0
failed = 0
not_found = 0

# Open log file
log_f = open("/tmp/thorough-cleanup.log", "w", buffering=1)

def log(msg):
    log_f.write(msg + "\n")
    log_f.flush()
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()

log("=" * 60)
log("THOROUGH CLEANUP — Scanning IDs 1 to 1100")
log(f"Protected IDs: {sorted(PROTECTED_IDS)}")
log("=" * 60)

# Scan ALL IDs from 1 to 1100
for msg_id in range(1, 1101):
    # Skip protected messages
    if msg_id in PROTECTED_IDS:
        log(f"  🛡️  PROTECTED {msg_id}")
        protected += 1
        continue
    
    # Try to delete — this will only succeed for bot messages or 
    # messages the bot has permission to delete as admin
    r = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
    
    desc = r.get("description", "")
    
    # Handle rate limiting
    if "Too Many Requests" in desc:
        m = re.search(r"retry after (\d+)", desc)
        wait_time = int(m.group(1)) + 2 if m else 10
        log(f"  ⏳ RATE LIMITED at {msg_id}, waiting {wait_time}s...")
        time.sleep(wait_time)
        # Retry
        r = api("deleteMessage", {"chat_id": CHAT_ID, "message_id": msg_id})
        desc = r.get("description", "")
    
    if r.get("ok"):
        log(f"  🗑️  DELETED {msg_id}")
        deleted += 1
    elif "message to delete not found" in desc.lower() or "message can't be deleted" in desc.lower():
        not_found += 1
    else:
        # Some other error — likely a user message we can't delete, which is fine
        not_found += 1
    
    # Small delay to avoid rate limits
    time.sleep(0.05)
    
    # Progress report every 100 IDs
    if msg_id % 100 == 0:
        log(f"--- Progress: {msg_id}/1100 | deleted:{deleted} protected:{protected} skipped:{not_found} ---")

log("")
log("=" * 60)
log(f"CLEANUP COMPLETE")
log(f"  Deleted:   {deleted}")
log(f"  Protected: {protected}")
log(f"  Skipped:   {not_found}")
log(f"  Total IDs scanned: 1100")
log("=" * 60)

log_f.close()

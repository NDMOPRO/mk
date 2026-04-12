"""
Targeted thread scanner — checks message IDs 1-500 in the group.
Uses copyMessage to detect existence, then forwardMessage to get sender info.
Immediately deletes any copies made.
"""
import urllib.request, json, time

TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84"
CHAT_ID = -1003967447285

def api(method, params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}

found = []
rate_wait = 0

print("Scanning IDs 1-500...\n")

for msg_id in range(1, 501):
    if rate_wait > 0:
        time.sleep(rate_wait)
        rate_wait = 0

    # Step 1: try copyMessage to detect existence
    r = api("copyMessage", {
        "chat_id": CHAT_ID,
        "from_chat_id": CHAT_ID,
        "message_id": msg_id,
        "disable_notification": True
    })

    desc = r.get("description", "")

    if "Too Many Requests" in desc:
        import re
        m = re.search(r"retry after (\d+)", desc)
        wait = int(m.group(1)) + 2 if m else 10
        print(f"  Rate limited at {msg_id}, waiting {wait}s...")
        time.sleep(wait)
        # retry
        r = api("copyMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })
        desc = r.get("description", "")

    if r.get("ok"):
        copy_id = r["result"]["message_id"]
        # Delete the copy immediately
        api("deleteMessage", {"chat_id": CHAT_ID, "message_id": copy_id})

        # Step 2: try forwardMessage to get sender info
        fwd = api("forwardMessage", {
            "chat_id": CHAT_ID,
            "from_chat_id": CHAT_ID,
            "message_id": msg_id,
            "disable_notification": True
        })

        sender_name = "bot/protected"
        sender_username = ""
        text = "(not forwardable)"
        thread = "?"

        if fwd.get("ok"):
            fmsg = fwd["result"]
            fwd_id = fmsg["message_id"]
            thread = fmsg.get("message_thread_id", "General")

            fwd_from = fmsg.get("forward_from") or {}
            fwd_origin = fmsg.get("forward_origin") or {}
            fwd_name = fmsg.get("forward_sender_name", "")

            if fwd_from:
                sender_name = f"{fwd_from.get('first_name','')} {fwd_from.get('last_name','')}".strip()
                sender_username = fwd_from.get("username", "")
            elif fwd_origin.get("sender_user"):
                su = fwd_origin["sender_user"]
                sender_name = f"{su.get('first_name','')} {su.get('last_name','')}".strip()
                sender_username = su.get("username", "")
            elif fwd_name:
                sender_name = fwd_name

            text = fmsg.get("text") or fmsg.get("caption") or "[media]"
            # Delete the forwarded copy
            api("deleteMessage", {"chat_id": CHAT_ID, "message_id": fwd_id})
        else:
            # Can't forward — it's a bot message or service message
            # Try to infer thread from the copy response
            thread = r.get("result", {}).get("message_thread_id", "?")

        entry = {
            "id": msg_id,
            "thread": thread,
            "sender": sender_name,
            "username": sender_username,
            "text": text[:200]
        }
        found.append(entry)

        is_mushtaq = "mushtaq" in sender_name.lower() or "mushtaq" in sender_username.lower()
        marker = "🔴 MUSHTAQ" if is_mushtaq else "  "
        print(f"{marker} ID:{msg_id} Thread:{thread} From:'{sender_name}' Text:{text[:80]}")

    elif "message to copy not found" in desc:
        pass  # doesn't exist
    elif "can't be copied" in desc:
        # Message exists but can't be copied (service message, etc.)
        print(f"  [service/pin] ID:{msg_id}")
    else:
        pass  # other error, skip

    time.sleep(0.2)

    if msg_id % 100 == 0:
        print(f"\n--- Progress: {msg_id}/500, found {len(found)} messages ---\n")

print(f"\n=== SCAN COMPLETE: {len(found)} messages found ===\n")

mushtaq = [m for m in found if "mushtaq" in m["sender"].lower() or "mushtaq" in m["username"].lower()]
print(f"=== MUSHTAQ MESSAGES: {len(mushtaq)} ===")
for m in mushtaq:
    print(f"  Thread:{m['thread']} ID:{m['id']} Text:{m['text']}")

print("\n=== ALL SENDERS ===")
senders = {}
for m in found:
    k = m["sender"]
    if k not in senders:
        senders[k] = []
    senders[k].append(m["thread"])
for name, threads in sorted(senders.items()):
    print(f"  {name}: threads {set(threads)}")

with open("/tmp/scan_results.json", "w") as f:
    json.dump(found, f, indent=2)
print("\nSaved to /tmp/scan_results.json")
